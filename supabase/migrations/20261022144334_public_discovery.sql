begin;
-- Actor identities belong to trusted auditing, not browser table projections.
revoke select on public.theses from public,anon,authenticated;
grant select(id,repository_code,source_id,source_archive_id,source_row_number,title,group_code,academic_year_id,section_block,abstract,status,version,published_at,created_at,updated_at,source_created_at) on public.theses to anon,authenticated;
create or replace function private.admin_record_document(record_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not private.is_admin() then raise exception 'Active administrator access required' using errcode='42501'; end if;
  select jsonb_build_object('id',t.id,'repository_code',t.repository_code,'source_id',t.source_id,'source_archive_id',t.source_archive_id,'source_row_number',t.source_row_number,'title',t.title,'group_code',t.group_code,'academic_year_id',t.academic_year_id,'section_block',t.section_block,'abstract',t.abstract,'status',t.status,'version',t.version,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,'source_created_at',t.source_created_at) || jsonb_build_object(
    'source_archive_id', t.source_archive_id::text, 'repository_code', t.repository_code::text,
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


-- Explicit public projection: never return actor IDs, student identifiers or staging.
create function public.public_record(record_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object('id',t.id,'repository_code',t.repository_code::text,'title',t.title,
'academicYear',y.label,'abstract',t.abstract,'group_code',t.group_code,'section_block',t.section_block,
'source_name',s.name,'source_row_number',t.source_row_number,'source_archive_id',t.source_archive_id::text,
'department',s.department,'campus',s.campus,'source_created_at',t.source_created_at,
'authors',coalesce((select jsonb_agg(a.full_name order by a.author_order) from public.thesis_authors a where a.thesis_id=t.id),'[]'),
'advisers',coalesce((select jsonb_agg(f.display_name order by a.adviser_order) from public.thesis_advisers a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id),'[]'),
'panel_members',coalesce((select jsonb_agg(f.display_name order by a.panel_order) from public.thesis_panel_members a join public.faculty_members f on f.id=a.faculty_id where a.thesis_id=t.id),'[]'),
'topics',coalesce((select jsonb_agg(k.name order by k.name,k.id) from public.thesis_topics x join public.topics k on k.id=x.topic_id where x.thesis_id=t.id),'[]'),
'keywords',coalesce((select jsonb_agg(k.name order by k.name,k.id) from public.thesis_keywords x join public.keywords k on k.id=x.keyword_id where x.thesis_id=t.id),'[]'))
from public.theses t join public.academic_years y on y.id=t.academic_year_id join public.sources s on s.id=t.source_id
where t.id=record_id and t.status='published'; $$;
revoke all on function public.public_record(uuid) from public,anon,authenticated;
grant execute on function public.public_record(uuid) to anon,authenticated;
create function public.search_records(q text default '', year_from integer default null,
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
    and (topic_id is null or exists(select 1 from public.thesis_topics x where x.thesis_id=t.id and x.topic_id=search_records.topic_id))
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
    coalesce((select jsonb_agg(public.public_record(id) order by
      case when sort='title' then lower(title) end asc nulls last,
      case when sort='newest' then start_year end desc nulls last,
      case when sort='oldest' then start_year end asc nulls last,id asc) from paged),'[]')) into result;
  return result;
end; $$;
revoke all on function public.search_records(text,integer,integer,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.search_records(text,integer,integer,uuid,text,integer) to anon,authenticated;


-- Topic choices are published-only even for signed-in administrators visiting public pages.
create function public.public_topics() returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('id',k.id,'name',k.name) order by k.name,k.id),'[]') from public.topics k
where exists(select 1 from public.thesis_topics x join public.theses t on t.id=x.thesis_id where x.topic_id=k.id and t.status='published'); $$;
revoke all on function public.public_topics() from public,anon,authenticated;
grant execute on function public.public_topics() to anon,authenticated;
commit;
