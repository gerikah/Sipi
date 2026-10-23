begin;
-- Preserve all tables, stored classifications, associations and previous migrations.
-- Legacy topic_id parameters remain for API compatibility, but no longer filter.
-- Browser saves omit topic_ids/keyword_ids so the existing save RPC preserves them.
create or replace function public.public_record(record_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object('id',t.id,'title',t.title,
'academicYear',y.label,'abstract',t.abstract,'group_code',t.group_code,'section_block',t.section_block,
'source_name',s.name,'source_archive_id',t.source_archive_id::text,
'source_created_at',t.source_created_at,
'authors',coalesce((select jsonb_agg(a.full_name order by a.author_order) from public.thesis_authors a where a.thesis_id=t.id),'[]'),
'advisers',coalesce((select jsonb_agg(f.display_name order by a.adviser_order) from public.thesis_advisers a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id),'[]'),
'panel_members',coalesce((select jsonb_agg(f.display_name order by a.panel_order) from public.thesis_panel_members a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id),'[]'))
from public.theses t join public.academic_years y on y.id=t.academic_year_id join public.sources s on s.id=t.source_id
where t.id=record_id and t.status='published'; $$;
revoke all on function public.public_record(uuid) from public,anon,authenticated;
grant execute on function public.public_record(uuid) to anon,authenticated;
create or replace function public.search_records(q text default '', year_from integer default null,
  year_to integer default null, topic_id uuid default null, sort text default 'newest', page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if page is null or page not between 1 and 100000
    or sort is null or sort not in ('newest','oldest','title') or length(coalesce(q,''))>200
    or (year_from is not null and year_from not between 1900 and 2199)
    or (year_to is not null and year_to not between 1900 and 2199)
    or year_from>year_to then raise exception 'Invalid search filters' using errcode='22023'; end if;
  with filtered as materialized (
    select t.id,t.title,y.start_year from public.theses t left join public.academic_years y on y.id=t.academic_year_id
    where t.status='published'
    and (year_from is null or y.start_year>=year_from) and (year_to is null or y.start_year<=year_to)
    and (coalesce(btrim(q),'')='' or strpos(lower(coalesce(t.title,'') || ' ' || coalesce(t.abstract,'') || ' ' || coalesce(t.group_code,'') || ' ' || coalesce(t.section_block,'') || ' ' || coalesce(t.source_archive_id::text,'')),lower(btrim(q)))>0
      or exists(select 1 from public.thesis_authors a where a.thesis_id=t.id and strpos(lower(a.full_name),lower(btrim(q)))>0)
      or exists(select 1 from public.thesis_advisers a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id and strpos(lower(f.display_name),lower(btrim(q)))>0)
      or exists(select 1 from public.thesis_panel_members a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id and strpos(lower(f.display_name),lower(btrim(q)))>0))
  ), paged as (
    select * from filtered order by
      case when sort='title' then lower(title) end asc nulls last,
      case when sort='newest' then start_year end desc nulls last,
      case when sort='oldest' then start_year end asc nulls last, id asc
    limit 24 offset (page-1)*24
  ) select jsonb_build_object('total',(select count(*) from filtered),'page',page,'items',
    coalesce((select jsonb_agg(public.public_record(id) order by
      case when sort='title' then lower(title) end asc nulls last,
      case when sort='newest' then start_year end desc nulls last,
      case when sort='oldest' then start_year end asc nulls last,id asc) from paged),'[]')) into result;
  return result;
end; $$;
revoke all on function public.search_records(text,integer,integer,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.search_records(text,integer,integer,uuid,text,integer) to anon,authenticated;



create or replace function public.admin_records(q text default '', record_status text default 'all', year_from integer default null,
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
    and (coalesce(btrim(q),'')='' or strpos(lower(coalesce(t.title,'') || ' ' || coalesce(t.abstract,'') || ' ' || coalesce(t.group_code,'') || ' ' || coalesce(t.section_block,'') || ' ' || coalesce(t.source_archive_id::text,'')),lower(btrim(q)))>0
      or exists(select 1 from public.thesis_authors a where a.thesis_id=t.id and strpos(lower(a.full_name),lower(btrim(q)))>0)
      or exists(select 1 from public.thesis_advisers a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id and strpos(lower(f.display_name),lower(btrim(q)))>0)
      or exists(select 1 from public.thesis_panel_members a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id and strpos(lower(f.display_name),lower(btrim(q)))>0))
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


create or replace function private.import_row_errors(p jsonb, raw jsonb, mapping jsonb, parse_errors jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare errors jsonb:=private.import_errors(p) || parse_errors; field text; original text;
begin
  foreach field in array array['authors','advisers','panel_members'] loop
    original:=nullif(btrim(raw->>(mapping->'columns'->>field)),'');
    if original is not null and lower(original) not in ('null','no record') and p->field='[]'::jsonb then
      errors:=errors || to_jsonb(field || ': review the supplied names; the source field is not empty');
    end if;
  end loop;
  -- Unmapping student_number must not bypass private-identifier review.
  if exists(select 1 from jsonb_each_text(raw) cell where lower(cell.key)='student_number'
    and nullif(btrim(cell.value),'') is not null and lower(btrim(cell.value))<>'null')
    and nullif(btrim(p->>'student_number'),'') is null then
    errors:=errors || '"student_number: verified author mapping is required; exclude this row"'::jsonb;
  end if;
  return errors;
end; $$;
revoke all on function private.import_row_errors(jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;


commit;
