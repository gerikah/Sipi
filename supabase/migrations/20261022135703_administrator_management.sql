begin;
-- Invoker reads retain RLS and explicitly require current active membership.
create function private.admin_record_document(record_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not private.is_admin() then raise exception 'Active administrator access required' using errcode='42501'; end if;
  select (to_jsonb(t) - array['created_by','updated_by']) || jsonb_build_object(
    'academic_year', (select label from public.academic_years where id=t.academic_year_id),
    'source_name', (select name from public.sources where id=t.source_id),
    'authors', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'full_name',a.full_name) order by a.author_order) from public.thesis_authors a where a.thesis_id=t.id),'[]'),
    'advisers', coalesce((select jsonb_agg(jsonb_build_object('faculty_id',f.id,'display_name',f.display_name) order by a.adviser_order) from public.thesis_advisers a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id),'[]'),
    'panel_members', coalesce((select jsonb_agg(jsonb_build_object('faculty_id',f.id,'display_name',f.display_name) order by a.panel_order) from public.thesis_panel_members a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id),'[]'),
    'topic_ids', coalesce((select jsonb_agg(topic_id order by topic_id) from public.thesis_topics where thesis_id=t.id),'[]'),
    'keyword_ids', coalesce((select jsonb_agg(keyword_id order by keyword_id) from public.thesis_keywords where thesis_id=t.id),'[]'))
  into result from public.theses t where t.id=record_id;
  return result;
end; $$;
revoke all on function private.admin_record_document(uuid) from public,anon,authenticated;
grant execute on function private.admin_record_document(uuid) to authenticated;
create function public.admin_record(record_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.admin_record_document(record_id); $$;
revoke all on function public.admin_record(uuid) from public,anon,authenticated;
grant execute on function public.admin_record(uuid) to authenticated;

create function public.admin_records(q text default '', record_status text default 'all', year_from integer default null,
  year_to integer default null, topic_id uuid default null, sort text default 'newest', page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not private.is_admin() then raise exception 'Active administrator access required' using errcode='42501'; end if;
  if page is null or page not between 1 and 100000 or record_status is null or record_status not in ('all','draft','published','archived')
    or sort is null or sort not in ('newest','oldest','title') or length(coalesce(q,''))>200
    or (year_from is not null and year_from not between 1900 and 2199)
    or (year_to is not null and year_to not between 1900 and 2199)
    or year_from>year_to then raise exception 'Invalid search filters' using errcode='22023'; end if;
  with filtered as materialized (
    select t.id,t.title,y.start_year from public.theses t left join public.academic_years y on y.id=t.academic_year_id
    where (record_status='all' or t.status=record_status)
    and (year_from is null or y.start_year>=year_from) and (year_to is null or y.start_year<=year_to)
    and (topic_id is null or exists(select 1 from public.thesis_topics x where x.thesis_id=t.id and x.topic_id=admin_records.topic_id))
    and (coalesce(btrim(q),'')='' or strpos(lower(coalesce(t.title,'') || ' ' || coalesce(t.abstract,'') || ' ' || coalesce(t.group_code,'') || ' ' || t.repository_code::text),lower(btrim(q)))>0
      or exists(select 1 from public.thesis_authors a where a.thesis_id=t.id and strpos(lower(a.full_name),lower(btrim(q)))>0)
      or exists(select 1 from public.thesis_advisers a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id and strpos(lower(f.display_name),lower(btrim(q)))>0)
      or exists(select 1 from public.thesis_keywords x join public.keywords k on k.id=x.keyword_id where x.thesis_id=t.id and strpos(lower(k.name),lower(btrim(q)))>0))
  ), paged as (
    select * from filtered order by
      case when sort='title' then lower(title) end asc nulls last,
      case when sort='newest' then start_year end desc nulls last,
      case when sort='oldest' then start_year end asc nulls last, id asc
    limit 24 offset (page-1)*24
  ) select jsonb_build_object('total',(select count(*) from filtered),'page',page,'items',
    coalesce((select jsonb_agg(private.admin_record_document(id) order by
      case when sort='title' then lower(title) end asc nulls last,
      case when sort='newest' then start_year end desc nulls last,
      case when sort='oldest' then start_year end asc nulls last,id asc) from paged),'[]')) into result;
  return result;
end; $$;
revoke all on function public.admin_records(text,text,integer,integer,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.admin_records(text,text,integer,integer,uuid,text,integer) to authenticated;

-- Existing sources are deliberately not creatable through this classification RPC.
create function private.save_classification(kind text, name text, item_id uuid default null, expected_name text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := private.require_admin(); target uuid; previous text; table_name text; start_year integer;
begin
  if kind is null or kind not in ('topic','keyword','academic_year') or name is null or length(btrim(name)) not between 1 and 120 then
    raise exception 'Enter a classification name of up to 120 characters' using errcode='22023'; end if;
  if kind='academic_year' then
    if item_id is not null or name !~ '^\d{4}-\d{4}$' then raise exception 'Use adjacent academic years, YYYY-YYYY' using errcode='22023'; end if;
    start_year := split_part(name,'-',1)::integer;
    if split_part(name,'-',2)::integer<>start_year+1 then raise exception 'Academic years must be adjacent' using errcode='22023'; end if;
    insert into public.academic_years(start_year,end_year) values(start_year,start_year+1) returning id into target;
  else
    table_name := case kind when 'topic' then 'topics' else 'keywords' end;
    if item_id is null then
      execute format('insert into public.%I(name) values($1) returning id',table_name) into target using btrim(name);
    else
      execute format('select name from public.%I where id=$1 for update',table_name) into previous using item_id;
      if previous is null then raise exception 'Classification not found' using errcode='P0002'; end if;
      if previous is distinct from expected_name then raise exception 'Classification changed; reload it' using errcode='40001'; end if;
      execute format('update public.%I set name=$1 where id=$2',table_name) using btrim(name),item_id;
      target:=item_id;
    end if;
  end if;
  insert into private.audit_logs(actor_id,action,changed_fields) values(actor,'classification_saved',array[kind,target::text]);
  return target;
end; $$;
revoke all on function private.save_classification(text,text,uuid,text) from public,anon,authenticated;
grant execute on function private.save_classification(text,text,uuid,text) to authenticated;
create function public.save_classification(kind text, name text, item_id uuid default null, expected_name text default null)
returns uuid language sql security invoker set search_path='' as $$ select private.save_classification(kind,name,item_id,expected_name); $$;
revoke all on function public.save_classification(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.save_classification(text,text,uuid,text) to authenticated;
commit;
