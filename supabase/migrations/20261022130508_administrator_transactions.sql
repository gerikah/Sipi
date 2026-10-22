begin;

-- Browser roles can read permitted rows, but cannot create objects or bypass RPCs.
revoke create on schema public from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on sequence public.theses_repository_code_seq from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;

-- Lock membership for the duration of each write. Disabling membership serializes
-- with in-flight writes; every subsequent transaction rechecks the current row.
create function private.require_admin() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  perform 1 from private.administrators where user_id = actor and active for share;
  if not found then raise exception 'Active administrator access required' using errcode = '42501'; end if;
  return actor;
end;
$$;
revoke all on function private.require_admin() from public, anon, authenticated;

create function private.save_record(payload jsonb, expected_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_admin();
  target uuid; previous public.theses; proposed public.theses; saved public.theses;
  field text; item jsonb; position integer; author_id uuid; faculty_id uuid;
  kept uuid[]; seen uuid[]; association text; order_column text;
  fields text[]; creating boolean;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 262144 then
    raise exception 'Provide a record object of at most 256 KB' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(payload) k where k <> all(array[
    'id','title','academic_year_id','source_id','source_archive_id','source_row_number',
    'group_code','section_block','abstract','source_created_at','authors','advisers','panel_members','topic_ids','keyword_ids'])) then
    raise exception 'Unknown or protected record field' using errcode = '22023';
  end if;
  foreach field in array array['id','title','academic_year_id','source_id','group_code','section_block','abstract','source_created_at'] loop
    if payload ? field and jsonb_typeof(payload->field) not in ('string','null') then
      raise exception 'Invalid text field: %', field using errcode = '22023';
    end if;
  end loop;
  foreach field in array array['source_archive_id','source_row_number'] loop
    if payload ? field and jsonb_typeof(payload->field) not in ('number','null') then
      raise exception 'Invalid numeric field: %', field using errcode = '22023';
    end if;
    if jsonb_typeof(payload->field)='number' and (payload->>field)::numeric <> trunc((payload->>field)::numeric) then
      raise exception 'Identifiers must be whole numbers' using errcode='22023';
    end if;
  end loop;
  if payload->>'source_created_at' is not null and payload->>'source_created_at' !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?$' then
    raise exception 'Source timestamp must have no timezone' using errcode='22023';
  end if;
  foreach field in array array['authors','advisers','panel_members','topic_ids','keyword_ids'] loop
    if payload ? field then
      if jsonb_typeof(payload->field) <> 'array' then raise exception '% must be a list', field using errcode = '22023'; end if;
      if jsonb_array_length(payload->field) > 100 then raise exception '% has too many entries', field using errcode = '22023'; end if;
    end if;
  end loop;
  target := (payload->>'id')::uuid;
  creating := target is null;
  if creating then
    if expected_version is not null then raise exception 'New records have no expected version' using errcode = '22023'; end if;
    target := gen_random_uuid();
  else
    select * into previous from public.theses where id = target for update;
    if not found then raise exception 'Record not found' using errcode = 'P0002'; end if;
    if expected_version is distinct from previous.version then raise exception 'Record changed; reload before saving' using errcode = '40001'; end if;
    if previous.status = 'archived' then raise exception 'Restore this record to draft before editing' using errcode = '22023'; end if;
  end if;
  select * into proposed from jsonb_populate_record(previous, payload - array['id','authors','advisers','panel_members','topic_ids','keyword_ids']);
  proposed.title := nullif(btrim(proposed.title), '');
  proposed.group_code := nullif(btrim(proposed.group_code), '');
  proposed.section_block := nullif(btrim(proposed.section_block), '');
  proposed.abstract := nullif(proposed.abstract, '');
  if creating then
    insert into public.theses(id,title,academic_year_id,source_id,source_archive_id,source_row_number,group_code,section_block,abstract,source_created_at,created_by,updated_by)
    values(target,proposed.title,proposed.academic_year_id,proposed.source_id,proposed.source_archive_id,proposed.source_row_number,proposed.group_code,proposed.section_block,proposed.abstract,proposed.source_created_at,actor,actor)
    returning * into saved;
  else
    update public.theses set title=proposed.title, academic_year_id=proposed.academic_year_id,
      source_id=proposed.source_id, source_archive_id=proposed.source_archive_id,
      source_row_number=proposed.source_row_number, group_code=proposed.group_code,
      section_block=proposed.section_block, abstract=proposed.abstract,
      source_created_at=proposed.source_created_at, updated_by=actor
    where id=target returning * into saved;
  end if;

  if payload ? 'authors' then
    kept := '{}'; position := 0;
    for item in select value from jsonb_array_elements(payload->'authors') loop
      position := position + 1;
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'full_name') is distinct from 'string'
        or nullif(btrim(item->>'full_name'),'') is null
        or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','full_name')) then
        raise exception 'Each author needs a name and optional existing ID' using errcode='22023';
      end if;
      author_id := (item->>'id')::uuid;
      if author_id is not null then
        if author_id = any(kept) or not exists(select 1 from public.thesis_authors where id=author_id and thesis_id=target) then
          raise exception 'Author ID must belong to this record and appear once' using errcode='22023';
        end if;
        update public.thesis_authors set full_name=btrim(item->>'full_name'), author_order=position where id=author_id;
      else
        insert into public.thesis_authors(thesis_id,full_name,author_order) values(target,btrim(item->>'full_name'),position) returning id into author_id;
      end if;
      kept := array_append(kept,author_id);
    end loop;
    delete from public.thesis_authors where thesis_id=target and not(id=any(kept));
  end if;

  foreach field in array array['advisers','panel_members'] loop
    if payload ? field then
      association := case field when 'advisers' then 'thesis_advisers' else 'thesis_panel_members' end;
      order_column := case field when 'advisers' then 'adviser_order' else 'panel_order' end;
      execute format('delete from public.%I where thesis_id=$1',association) using target;
      position := 0; seen := '{}';
      for item in select value from jsonb_array_elements(payload->field) loop
        position := position + 1;
        if jsonb_typeof(item) <> 'object' or exists(select 1 from jsonb_object_keys(item) k where k not in ('faculty_id','display_name'))
          or (item ? 'faculty_id') = (item ? 'display_name') then
          raise exception 'Supply a reviewed faculty ID or a new display name' using errcode='22023';
        end if;
        if item ? 'faculty_id' then
          faculty_id := (item->>'faculty_id')::uuid;
          if faculty_id is null or faculty_id=any(seen) or not exists(select 1 from public.faculty_members where id=faculty_id) then
            raise exception 'Invalid or repeated faculty ID' using errcode='22023';
          end if;
        else
          if jsonb_typeof(item->'display_name') is distinct from 'string' or nullif(btrim(item->>'display_name'),'') is null then
            raise exception 'Enter a faculty name' using errcode='22023';
          end if;
          insert into public.faculty_members(display_name) values(btrim(item->>'display_name')) returning id into faculty_id;
        end if;
        seen := array_append(seen,faculty_id);
        execute format('insert into public.%I(thesis_id,faculty_id,%I) values($1,$2,$3)',association,order_column) using target,faculty_id,position;
      end loop;
    end if;
  end loop;
  if payload ? 'topic_ids' then
    delete from public.thesis_topics where thesis_id=target;
    insert into public.thesis_topics(thesis_id,topic_id) select target,value::uuid from jsonb_array_elements_text(payload->'topic_ids');
  end if;
  if payload ? 'keyword_ids' then
    delete from public.thesis_keywords where thesis_id=target;
    insert into public.thesis_keywords(thesis_id,keyword_id) select target,value::uuid from jsonb_array_elements_text(payload->'keyword_ids');
  end if;
  -- Check now as well as at commit, so callers cannot observe a successful RPC
  -- result before discovering a missing publication author.
  if saved.status='published' and not exists(select 1 from public.thesis_authors where thesis_id=target) then
    raise exception 'Published records require at least one author' using errcode='23514';
  end if;
  select coalesce(array_agg(k order by k),'{}') into fields from jsonb_object_keys(payload) k where k <> 'id';
  insert into private.audit_logs(actor_id,thesis_id,action,changed_fields)
    values(actor,target,case when creating then 'record_created' else 'record_saved' end,fields);
  return jsonb_build_object('id',target,'version',saved.version,'status',saved.status);
end;
$$;
revoke all on function private.save_record(jsonb,integer) from public, anon;
grant execute on function private.save_record(jsonb,integer) to authenticated;
create function public.save_record(payload jsonb, expected_version integer default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.save_record(payload,expected_version);
$$;
revoke all on function public.save_record(jsonb,integer) from public, anon;
grant execute on function public.save_record(jsonb,integer) to authenticated;

create function private.set_record_status(id uuid, status text, expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_admin(); current_record public.theses; saved public.theses;
begin
  select * into current_record from public.theses t where t.id=set_record_status.id for update;
  if not found then raise exception 'Record not found' using errcode='P0002'; end if;
  if expected_version is distinct from current_record.version then raise exception 'Record changed; reload before saving' using errcode='40001'; end if;
  if status is null or not (
    (current_record.status='draft' and status in ('published','archived')) or
    (current_record.status='published' and status in ('draft','archived')) or
    (current_record.status='archived' and status='draft')) then
    raise exception 'Invalid record status transition' using errcode='22023';
  end if;
  if status='published' and (current_record.title is null or current_record.academic_year_id is null or current_record.source_id is null
    or not exists(select 1 from public.thesis_authors where thesis_id=current_record.id)) then
    raise exception 'Publishing requires a title, academic year, author and source' using errcode='23514';
  end if;
  update public.theses t set status=set_record_status.status,
    published_at=case when set_record_status.status='published' then now() else t.published_at end, updated_by=actor
    where t.id=current_record.id returning * into saved;
  insert into private.audit_logs(actor_id,thesis_id,action,changed_fields)
    values(actor,current_record.id,'status_' || status,array['status']);
  return jsonb_build_object('id',saved.id,'version',saved.version,'status',saved.status);
end;
$$;
revoke all on function private.set_record_status(uuid,text,integer) from public, anon;
grant execute on function private.set_record_status(uuid,text,integer) to authenticated;
create function public.set_record_status(id uuid, status text, expected_version integer)
returns jsonb language sql security invoker set search_path='' as $$
  select private.set_record_status(id,status,expected_version);
$$;
revoke all on function public.set_record_status(uuid,text,integer) from public, anon;
grant execute on function public.set_record_status(uuid,text,integer) to authenticated;

comment on function public.save_record(jsonb,integer) is 'Patch supplied scalar fields; supplied lists replace associations. Existing author IDs preserve private identifiers. Audit changed_fields lists submitted fields, not value diffs.';
commit;
