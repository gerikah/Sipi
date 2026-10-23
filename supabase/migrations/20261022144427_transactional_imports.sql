begin;
alter table private.import_batches add column request_fingerprint text;
alter table private.import_rows add column duplicate_reviewed boolean not null default false;
alter table private.import_rows add column skip_reason text;
alter table private.import_rows add column parse_errors jsonb not null default '[]';

create function private.import_errors(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare errors jsonb := '[]'; field text; item jsonb; year_start integer;
begin
  if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>262144 then
    return '["row: provide an object of at most 256 KB"]'::jsonb;
  end if;
  if exists(select 1 from jsonb_object_keys(p) k where k<>all(array['title','academic_year','authors','advisers','panel_members','abstract','group_code','section_block','source_archive_id','source_created_at','student_number'])) then
    errors:=errors || '"row: unknown or protected field"'::jsonb;
  end if;
  foreach field in array array['title','academic_year','abstract','group_code','section_block','source_archive_id','source_created_at','student_number'] loop
    if p ? field and jsonb_typeof(p->field) not in ('string','null') then errors:=errors || to_jsonb(field || ': expected text or empty'); end if;
  end loop;
  if nullif(btrim(p->>'title'),'') is null then errors:=errors || '"title: enter a title"'::jsonb; end if;
  if coalesce(p->>'academic_year','') !~ '^\d{4}-\d{4}$' then errors:=errors || '"academic_year: use YYYY-YYYY"'::jsonb;
  else
    year_start:=split_part(p->>'academic_year','-',1)::integer;
    if year_start not between 1900 and 2199 or split_part(p->>'academic_year','-',2)::integer<>year_start+1 then
      errors:=errors || '"academic_year: use adjacent years from 1900 to 2200"'::jsonb;
    end if;
  end if;
  foreach field in array array['authors','advisers','panel_members'] loop
    if jsonb_typeof(p->field) is distinct from 'array' then errors:=errors || to_jsonb(field || ': provide an ordered list');
    elsif jsonb_array_length(p->field)>100 or (field='authors' and jsonb_array_length(p->field)=0) then errors:=errors || to_jsonb(field || ': authors require 1–100 names; other lists allow 0–100');
    else
      for item in select value from jsonb_array_elements(p->field) loop
        if jsonb_typeof(item)<>'string' or nullif(btrim(item #>> '{}'),'') is null then errors:=errors || to_jsonb(field || ': each entry needs a name'); exit; end if;
      end loop;
    end if;
  end loop;
  if p->>'source_archive_id' is not null then
    begin
      if p->>'source_archive_id' !~ '^[1-9][0-9]{0,18}$' or (p->>'source_archive_id')::bigint<=0 then raise invalid_parameter_value; end if;
    exception when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range then
      errors:=errors || '"source_archive_id: use a positive PostgreSQL bigint"'::jsonb;
    end;
  end if;
  if p->>'source_created_at' is not null then
    begin
      if p->>'source_created_at' !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?$' then raise invalid_parameter_value; end if;
      perform (p->>'source_created_at')::timestamp;
    exception when invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then
      errors:=errors || '"source_created_at: use a valid YYYY-MM-DD HH:mm:ss without timezone"'::jsonb;
    end;
  end if;
  if nullif(btrim(p->>'student_number'),'') is not null then
    errors:=errors || '"student_number: private identity mapping needs separate review; exclude this row"'::jsonb;
  end if;
  return errors;
end; $$;
revoke all on function private.import_errors(jsonb) from public,anon,authenticated;


create function private.import_row_errors(p jsonb, raw jsonb, mapping jsonb, parse_errors jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare errors jsonb:=private.import_errors(p) || parse_errors; field text; original text;
begin
  foreach field in array array['authors','advisers','panel_members'] loop
    original:=nullif(btrim(raw->>(mapping->'columns'->>field)),'');
    if original is not null and lower(original) not in ('null','no record') and p->field='[]'::jsonb then
      errors:=errors || to_jsonb(field || ': review the supplied names; the source field is not empty');
    end if;
  end loop;
  return errors;
end; $$;
revoke all on function private.import_row_errors(jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;

create function private.import_title(value text) returns text language sql immutable set search_path='' as $$
  select lower(regexp_replace(coalesce(value,''),'[^[:alnum:]]','','g'));
$$;
revoke all on function private.import_title(text) from public,anon,authenticated;

-- Compare name lists without treating names as unique person identities.
create function private.import_author_names(value jsonb) returns text[] language sql immutable set search_path='' as $$
  select coalesce(array_agg(private.import_title(name) order by private.import_title(name)),array[]::text[])
  from jsonb_array_elements_text(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end) names(name);
$$;
revoke all on function private.import_author_names(jsonb) from public,anon,authenticated;

create function private.import_duplicates(batch uuid, row_no integer, payload jsonb) returns jsonb
language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(reason order by reason::text),'[]') from (
    select jsonb_build_object('kind',case when t.source_id=b.source_id and t.source_archive_id::text=payload->>'source_archive_id' then 'existing_id' else 'similar_title' end,
      'same_year',coalesce((select y.label=payload->>'academic_year' from public.academic_years y where y.id=t.academic_year_id),false),
      'same_authors',private.import_author_names(payload->'authors')=private.import_author_names((select jsonb_agg(a.full_name) from public.thesis_authors a where a.thesis_id=t.id)),
      'record_id',t.id,'reason',case when t.source_id=b.source_id and t.source_archive_id::text=payload->>'source_archive_id' then 'This archive ID already exists in the selected source.' else 'Similar title in an existing record; compare its year and authors.' end) reason
    from public.theses t join private.import_batches b on b.id=batch
    where (t.source_id=b.source_id and t.source_archive_id::text=payload->>'source_archive_id')
      or (length(private.import_title(payload->>'title'))>=8 and
        (strpos(private.import_title(t.title),private.import_title(payload->>'title'))>0 or strpos(private.import_title(payload->>'title'),nullif(private.import_title(t.title),''))>0))
    union all
    select jsonb_build_object('kind',case when r.normalized_payload->>'source_archive_id'=payload->>'source_archive_id' then 'file_id' else 'file_title' end,
      'same_year',coalesce(r.normalized_payload->>'academic_year'=payload->>'academic_year',false),
      'same_authors',private.import_author_names(payload->'authors')=private.import_author_names(r.normalized_payload->'authors'),
      'row_number',r.row_number,'reason',case when r.normalized_payload->>'source_archive_id'=payload->>'source_archive_id' then 'Repeated archive ID in this file; select at most one row.' else 'Similar title in this file; review the year and ordered authors.' end)
    from private.import_rows r where r.batch_id=batch and r.row_number<>row_no and
      ((r.normalized_payload->>'source_archive_id'=payload->>'source_archive_id') or
       (length(private.import_title(payload->>'title'))>=8 and
       (strpos(private.import_title(r.normalized_payload->>'title'),private.import_title(payload->>'title'))>0 or strpos(private.import_title(payload->>'title'),nullif(private.import_title(r.normalized_payload->>'title'),''))>0)))
  ) candidates;
$$;
revoke all on function private.import_duplicates(uuid,integer,jsonb) from public,anon,authenticated;

create function private.import_document(batch uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); result jsonb;
begin
  select jsonb_build_object('id',b.id,'status',b.status,'source_id',b.source_id,'filename',b.original_filename,
    'total',b.total_rows,'imported',b.imported_rows,'skipped',b.skipped_rows,'invalid',b.invalid_rows,'failed',0,
    'rows',coalesce((select jsonb_agg(jsonb_build_object('row_number',r.row_number,'payload',r.normalized_payload-'student_number',
      'errors',r.validation_errors,'duplicates',r.duplicate_candidates,'decision',r.decision,'reviewed',r.duplicate_reviewed,
      'reason',r.skip_reason,'thesis_id',r.thesis_id) order by r.row_number) from private.import_rows r where r.batch_id=b.id),'[]'))
  into result from private.import_batches b where b.id=batch and b.uploaded_by=actor;
  if result is null then raise exception 'Import unavailable' using errcode='42501'; end if;
  return result;
end; $$;
revoke all on function private.import_document(uuid) from public,anon,authenticated;

create function private.stage_import(batch_id uuid, source_id uuid, filename text, file_hash text, mapping jsonb, rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); b private.import_batches; r jsonb; n integer:=0; fingerprint text;
begin
  if batch_id is null or filename is null or length(filename) not between 1 and 255 or file_hash is null or file_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(mapping) is distinct from 'object' or jsonb_typeof(rows) is distinct from 'array' then raise exception 'Invalid import request' using errcode='22023'; end if;
  if jsonb_array_length(rows) not between 1 and 200 or octet_length(rows::text)>6291456 or octet_length(mapping::text)>16384 then raise exception 'Import limit exceeded' using errcode='22023'; end if;
  if not exists(select 1 from public.sources s where s.id=source_id) then raise exception 'Choose an existing source' using errcode='22023'; end if;
  fingerprint:=md5(jsonb_build_array(source_id,filename,file_hash,mapping,rows)::text);
  -- A stable client UUID makes a lost staging response safely retryable.
  insert into private.import_batches(id,source_id,uploaded_by,original_filename,file_sha256,column_mapping,total_rows,request_fingerprint)
    values(batch_id,source_id,actor,filename,file_hash,mapping,jsonb_array_length(rows),fingerprint) on conflict(id) do nothing;
  select * into b from private.import_batches where id=batch_id for update;
  if b.uploaded_by is distinct from actor then raise exception 'Import unavailable' using errcode='42501'; end if;
  if b.request_fingerprint is distinct from fingerprint then raise exception 'Use a new batch for changed input' using errcode='22023'; end if;
  if exists(select 1 from private.import_rows where import_rows.batch_id=b.id) then return private.import_document(b.id); end if;
  for r in select value from jsonb_array_elements(rows) loop
    n:=n+1;
    if jsonb_typeof(r->'raw') is distinct from 'object' or jsonb_typeof(r->'errors') is distinct from 'array' then raise exception 'Each row needs original cells and parser errors' using errcode='22023'; end if;
    if jsonb_array_length(r->'errors')>64 or exists(select 1 from jsonb_array_elements(r->'errors') e where jsonb_typeof(e)<>'string' or length(e #>> '{}')>400) then raise exception 'Invalid parser errors' using errcode='22023'; end if;
    insert into private.import_rows(batch_id,row_number,raw_payload,normalized_payload,validation_errors,parse_errors)
      values(b.id,n,r->'raw',r->'payload',private.import_row_errors(r->'payload',r->'raw',mapping,r->'errors'),r->'errors');
  end loop;
  update private.import_rows x set duplicate_candidates=private.import_duplicates(b.id,x.row_number,x.normalized_payload) where x.batch_id=b.id;
  update private.import_rows x set decision=case when x.validation_errors<>'[]' or x.duplicate_candidates<>'[]' then 'skip' else 'pending' end,
    skip_reason=case when x.validation_errors<>'[]' then 'Invalid values; excluded.' when x.duplicate_candidates<>'[]' then 'Duplicate review required; excluded by default.' end where x.batch_id=b.id;
  update private.import_batches set invalid_rows=(select count(*) from private.import_rows where import_rows.batch_id=b.id and validation_errors<>'[]') where id=b.id;
  insert into private.audit_logs(actor_id,batch_id,action) values(actor,b.id,'import_staged');
  return private.import_document(b.id);
end; $$;
revoke all on function private.stage_import(uuid,uuid,text,text,jsonb,jsonb) from public,anon,authenticated;

create function private.review_import(batch_id uuid, selected_rows integer[], acknowledged_rows integer[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); b private.import_batches; r private.import_rows;
begin
  select * into b from private.import_batches where id=batch_id and uploaded_by=actor for update;
  if not found then raise exception 'Import unavailable' using errcode='42501'; end if;
  if b.status='committed' then return private.import_document(b.id); end if;
  if b.status not in ('staged','reviewed') then raise exception 'This import is no longer active' using errcode='22023'; end if;
  if selected_rows is null or cardinality(selected_rows)=0 or cardinality(selected_rows)>200 or
    exists(select 1 from unnest(selected_rows) n where n is null or n<1 or n>b.total_rows) then raise exception 'Select valid rows to import' using errcode='22023'; end if;
  for r in select * from private.import_rows where import_rows.batch_id=b.id order by row_number loop
    r.validation_errors:=private.import_row_errors(r.normalized_payload,r.raw_payload,b.column_mapping,r.parse_errors);
    r.duplicate_candidates:=private.import_duplicates(b.id,r.row_number,r.normalized_payload);
    if r.row_number=any(selected_rows) then
      if r.validation_errors<>'[]' then raise exception 'Row % has invalid fields',r.row_number using errcode='22023'; end if;
      if exists(select 1 from jsonb_array_elements(r.duplicate_candidates) d where d->>'kind'='existing_id') then raise exception 'Row % already exists; exclude it',r.row_number using errcode='23505'; end if;
      if r.duplicate_candidates<>'[]' and not coalesce(r.row_number=any(acknowledged_rows),false) then raise exception 'Review duplicate warnings for row %',r.row_number using errcode='22023'; end if;
    end if;
    update private.import_rows set validation_errors=r.validation_errors,duplicate_candidates=r.duplicate_candidates,
      decision=case when r.row_number=any(selected_rows) then 'import' else 'skip' end,
      duplicate_reviewed=coalesce(r.row_number=any(acknowledged_rows),false),
      skip_reason=case when r.row_number=any(selected_rows) then null when r.validation_errors<>'[]' then 'Invalid values; excluded.'
        when exists(select 1 from jsonb_array_elements(r.duplicate_candidates) d where d->>'kind'='existing_id') then 'Source archive ID already exists.' else 'Excluded by administrator.' end
      where id=r.id;
  end loop;
  if exists(select 1 from private.import_rows where import_rows.batch_id=b.id and decision='import' and normalized_payload->>'source_archive_id' is not null
    group by normalized_payload->>'source_archive_id' having count(*)>1) then raise exception 'Select only one row per source archive ID' using errcode='23505'; end if;
  update private.import_batches set status='reviewed' where id=b.id;
  return private.import_document(b.id);
end; $$;
revoke all on function private.review_import(uuid,integer[],integer[]) from public,anon,authenticated;

create function private.commit_import(batch_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); b private.import_batches; r private.import_rows; p jsonb; saved jsonb; year_id uuid; import_year_start integer;
begin
  select * into b from private.import_batches where id=batch_id and uploaded_by=actor for update;
  if not found then raise exception 'Import unavailable' using errcode='42501'; end if;
  if b.status='committed' then return private.import_document(b.id); end if;
  if b.status<>'reviewed' then raise exception 'Review selected rows first' using errcode='22023'; end if;
  -- Serialize commits and normal thesis writes before fresh duplicate checks.
  lock table public.theses in share row exclusive mode;
  for r in select * from private.import_rows where import_rows.batch_id=b.id and decision='import' order by row_number loop
    if (private.import_errors(r.normalized_payload) || r.parse_errors)<>'[]' then raise exception 'Row % is no longer valid',r.row_number using errcode='22023'; end if;
    if private.import_duplicates(b.id,r.row_number,r.normalized_payload) is distinct from r.duplicate_candidates then
      raise exception 'Duplicate candidates changed for row %; review this batch again',r.row_number using errcode='40001'; end if;
    if exists(select 1 from jsonb_array_elements(r.duplicate_candidates) d where d->>'kind'='existing_id') or
      (r.duplicate_candidates<>'[]' and not r.duplicate_reviewed) then raise exception 'Unreviewed duplicates in row %',r.row_number using errcode='23505'; end if;
  end loop;
  if not exists(select 1 from private.import_rows where import_rows.batch_id=b.id and decision='import') then raise exception 'No selected rows' using errcode='22023'; end if;
  for r in select * from private.import_rows where import_rows.batch_id=b.id and decision='import' order by row_number loop
    p:=r.normalized_payload;
    import_year_start:=split_part(p->>'academic_year','-',1)::integer;
    insert into public.academic_years(start_year,end_year) values(import_year_start,import_year_start+1) on conflict(start_year,end_year) do nothing;
    select id into year_id from public.academic_years y where y.start_year=import_year_start and y.end_year=import_year_start+1;
    saved:=public.save_record(jsonb_build_object('title',btrim(p->>'title'),'academic_year_id',year_id,'source_id',b.source_id,
      'source_archive_id',p->>'source_archive_id','source_row_number',r.row_number,'source_created_at',p->>'source_created_at',
      'group_code',nullif(btrim(p->>'group_code'),''),'section_block',nullif(btrim(p->>'section_block'),''),'abstract',p->>'abstract',
      'authors',(select jsonb_agg(jsonb_build_object('full_name',value) order by ord) from jsonb_array_elements_text(p->'authors') with ordinality a(value,ord)),
      'advisers',coalesce((select jsonb_agg(jsonb_build_object('display_name',value) order by ord) from jsonb_array_elements_text(p->'advisers') with ordinality a(value,ord)),'[]'),
      'panel_members',coalesce((select jsonb_agg(jsonb_build_object('display_name',value) order by ord) from jsonb_array_elements_text(p->'panel_members') with ordinality a(value,ord)),'[]')),null);
    update private.import_rows set thesis_id=(saved->>'id')::uuid where id=r.id;
    insert into private.audit_logs(actor_id,thesis_id,batch_id,action) values(actor,(saved->>'id')::uuid,b.id,'record_imported');
  end loop;
  update private.import_batches set status='committed',committed_at=now(),
    imported_rows=(select count(*) from private.import_rows where import_rows.batch_id=b.id and decision='import'),
    skipped_rows=(select count(*) from private.import_rows where import_rows.batch_id=b.id and decision='skip'),
    invalid_rows=(select count(*) from private.import_rows where import_rows.batch_id=b.id and validation_errors<>'[]') where id=b.id;
  insert into private.audit_logs(actor_id,batch_id,action) values(actor,b.id,'import_committed');
  return private.import_document(b.id);
end; $$;
revoke all on function private.commit_import(uuid) from public,anon,authenticated;


-- A status check also refreshes validation/duplicate evidence for unfinished batches.
-- New evidence invalidates the prior confirmation, so retries cannot use stale review.
create function private.refresh_import(batch_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); b private.import_batches; r private.import_rows; errors jsonb; candidates jsonb; changed boolean:=false;
begin
  select * into b from private.import_batches where id=batch_id and uploaded_by=actor for update;
  if not found then raise exception 'Import unavailable' using errcode='42501'; end if;
  if b.status in ('staged','reviewed') then
    for r in select * from private.import_rows where import_rows.batch_id=b.id loop
      errors:=private.import_row_errors(r.normalized_payload,r.raw_payload,b.column_mapping,r.parse_errors);
      candidates:=private.import_duplicates(b.id,r.row_number,r.normalized_payload);
      if errors is distinct from r.validation_errors or candidates is distinct from r.duplicate_candidates then
        changed:=true;
        update private.import_rows set validation_errors=errors,duplicate_candidates=candidates,decision='skip',duplicate_reviewed=false,
          skip_reason='Validation or duplicate evidence changed; review this row again.' where id=r.id;
      end if;
    end loop;
    if changed then update private.import_batches set status='staged',invalid_rows=(select count(*) from private.import_rows where import_rows.batch_id=b.id and validation_errors<>'[]') where id=b.id; end if;
  end if;
  return private.import_document(b.id);
end; $$;
revoke all on function private.refresh_import(uuid) from public,anon,authenticated;
grant execute on function private.refresh_import(uuid) to authenticated;

create function public.stage_import(batch_id uuid, source_id uuid, filename text, file_hash text, mapping jsonb, rows jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.stage_import(batch_id,source_id,filename,file_hash,mapping,rows); $$;
create function public.review_import(batch_id uuid, selected_rows integer[], acknowledged_rows integer[]) returns jsonb
language sql security invoker set search_path='' as $$ select private.review_import(batch_id,selected_rows,acknowledged_rows); $$;
create function public.commit_import(batch_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.commit_import(batch_id); $$;
create function public.get_import(batch_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.refresh_import(batch_id); $$;
revoke all on function public.stage_import(uuid,uuid,text,text,jsonb,jsonb), public.review_import(uuid,integer[],integer[]), public.commit_import(uuid), public.get_import(uuid) from public,anon,authenticated;
grant execute on function private.stage_import(uuid,uuid,text,text,jsonb,jsonb), private.review_import(uuid,integer[],integer[]), private.commit_import(uuid), private.import_document(uuid),
 public.stage_import(uuid,uuid,text,text,jsonb,jsonb), public.review_import(uuid,integer[],integer[]), public.commit_import(uuid), public.get_import(uuid) to authenticated;

create function public.list_imports() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); result jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc,b.id),'[]') into result from
    (select id,original_filename as filename,status,created_at from private.import_batches where uploaded_by=actor order by created_at desc,id limit 20) b;
  return result;
end; $$;
revoke all on function public.list_imports() from public,anon,authenticated;
grant execute on function public.list_imports() to authenticated;

-- Trusted scheduled maintenance only. Keep batch IDs, decisions, counts and links
-- for idempotent retries/audit; erase raw and normalized personal data after 30 days.
create function private.cleanup_imports() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  perform id from private.import_batches where created_at<now()-interval '30 days' for update;
  update private.import_rows r set raw_payload='{}',normalized_payload=null,duplicate_candidates='[]'
    from private.import_batches b where r.batch_id=b.id and b.created_at<now()-interval '30 days';
  get diagnostics n=row_count;
  update private.import_batches set column_mapping='{}',status=case when status='committed' then status else 'cancelled' end
    where created_at<now()-interval '30 days';
  return n;
end; $$;
revoke all on function private.cleanup_imports() from public,anon,authenticated;
commit;
