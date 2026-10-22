begin;
-- Return bigint identifiers as decimal text and normalize archive strings in SQL.
create or replace function private.admin_record_document(record_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not private.is_admin() then raise exception 'Active administrator access required' using errcode='42501'; end if;
  select (to_jsonb(t) - array['created_by','updated_by']) || jsonb_build_object(
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

create or replace function public.save_record(payload jsonb, expected_version integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Active administrator access required' using errcode='42501'; end if;
  if jsonb_typeof(payload->'source_archive_id')='string' then
    if payload->>'source_archive_id' !~ '^[1-9][0-9]{0,18}$' then
      raise exception 'Archive IDs must be positive whole numbers' using errcode='22023';
    end if;
    payload := jsonb_set(payload,'{source_archive_id}',to_jsonb((payload->>'source_archive_id')::bigint));
  end if;
  return private.save_record(payload,expected_version);
end; $$;
revoke all on function public.save_record(jsonb,integer) from public,anon;
grant execute on function public.save_record(jsonb,integer) to authenticated;

commit;
