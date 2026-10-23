-- Additive repair for the live installation that skipped discovery grants.
-- No data changes. Safe on both clean migration order and inspected live schema.
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



-- Platform event triggers do not need browser execution privileges.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end; $$;
notify pgrst, 'reload schema';
commit;
