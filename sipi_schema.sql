-- Sipi schema foundation for a NEW Supabase project.
-- Review against existing migrations before applying. No data is imported here.
-- Application reads are enabled; writes require the transactional RPCs described
-- in database_schema.md. Those RPCs are intentionally a later migration.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table private.administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.administrators enable row level security;
revoke all on private.administrators from public, anon, authenticated;

-- Membership is administered through trusted SQL, never editable user metadata.
create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.administrators a
    where a.user_id = (select auth.uid()) and a.active
  );
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- Browser session checks can call this RPC; it returns only caller membership.
create function public.is_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$ select private.is_admin(); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  start_year smallint not null check (start_year between 1900 and 2199),
  end_year smallint not null,
  label text generated always as (start_year::text || '-' || end_year::text) stored,
  unique (start_year, end_year),
  check (end_year = start_year + 1)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  department text not null default 'Computer Engineering',
  campus text not null default 'PUP Main Campus, Sta. Mesa, Manila',
  coverage_start_year smallint,
  coverage_end_year smallint,
  coverage_verified boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  check (coverage_start_year is null or coverage_start_year between 1900 and 2199),
  check (coverage_end_year is null or coverage_end_year between 1900 and 2200),
  check (coverage_end_year >= coverage_start_year),
  check (not coverage_verified or
    (coverage_start_year is not null and coverage_end_year is not null))
);

create table public.theses (
  id uuid primary key default gen_random_uuid(),
  repository_code bigint generated always as identity unique,
  source_id uuid references public.sources(id) on delete restrict,
  source_archive_id bigint check (source_archive_id > 0),
  source_row_number integer check (source_row_number > 0),
  title text check (title is null or btrim(title) <> ''),
  group_code text check (group_code is null or btrim(group_code) <> ''),
  academic_year_id uuid references public.academic_years(id) on delete restrict,
  section_block text check (section_block is null or btrim(section_block) <> ''),
  abstract text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  version integer not null default 1 check (version > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  -- Original CSV timestamp has no timezone. Preserve it without guessing one.
  source_created_at timestamp without time zone,
  unique (source_id, source_archive_id),
  check (source_archive_id is null or source_id is not null),
  check (status <> 'published' or
    (title is not null and academic_year_id is not null and
     source_id is not null and published_at is not null))
);

-- Ordered names belong to a thesis; identical names are not merged automatically.
create table public.thesis_authors (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references public.theses(id) on delete cascade,
  full_name text not null check (btrim(full_name) <> ''),
  author_order smallint not null check (author_order > 0),
  unique (thesis_id, author_order) deferrable initially deferred
);

create table public.faculty_members (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> '')
);
-- No UNIQUE(name): matching is reviewed, not assumed from equal strings.
create table public.thesis_advisers (
  thesis_id uuid not null references public.theses(id) on delete cascade,
  faculty_id uuid not null references public.faculty_members(id) on delete restrict,
  adviser_order smallint not null default 1 check (adviser_order > 0),
  primary key (thesis_id, faculty_id),
  unique (thesis_id, adviser_order) deferrable initially deferred
);
create table public.thesis_panel_members (
  thesis_id uuid not null references public.theses(id) on delete cascade,
  faculty_id uuid not null references public.faculty_members(id) on delete restrict,
  panel_order smallint not null check (panel_order > 0),
  primary key (thesis_id, faculty_id),
  unique (thesis_id, panel_order) deferrable initially deferred
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  normalized_name text generated always as (lower(btrim(name))) stored unique
);
create table public.thesis_topics (
  thesis_id uuid not null references public.theses(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete restrict,
  primary key (thesis_id, topic_id)
);
create table public.keywords (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  normalized_name text generated always as (lower(btrim(name))) stored unique
);
create table public.thesis_keywords (
  thesis_id uuid not null references public.theses(id) on delete cascade,
  keyword_id uuid not null references public.keywords(id) on delete restrict,
  primary key (thesis_id, keyword_id)
);

-- Optional sensitive identifiers are separate from public author data.
-- The uploaded CSV supplies no student numbers, so create no identifier rows.
create table private.author_identifiers (
  author_id uuid primary key references public.thesis_authors(id) on delete cascade,
  student_number text not null check (btrim(student_number) <> '')
);
create table private.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  uploaded_by uuid references auth.users(id) on delete set null,
  original_filename text not null,
  file_sha256 text check (file_sha256 ~ '^[0-9a-f]{64}$'),
  column_mapping jsonb not null default '{}'::jsonb,
  status text not null default 'staged'
    check (status in ('staged', 'reviewed', 'committed', 'failed', 'cancelled')),
  total_rows integer not null default 0 check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  check (status <> 'committed' or committed_at is not null)
);
create table private.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references private.import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  normalized_payload jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  duplicate_candidates jsonb not null default '[]'::jsonb,
  decision text not null default 'pending'
    check (decision in ('pending', 'import', 'skip')),
  thesis_id uuid references public.theses(id) on delete restrict,
  unique (batch_id, row_number)
);
create table private.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  thesis_id uuid references public.theses(id) on delete restrict,
  batch_id uuid references private.import_batches(id) on delete restrict,
  action text not null check (btrim(action) <> ''),
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index theses_status_academic_year_idx on public.theses(status, academic_year_id, id);
create index theses_source_idx on public.theses(source_id);
create index theses_group_code_idx on public.theses(group_code);
create index theses_title_search_idx on public.theses using gin
  (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(abstract, '')));
create index thesis_advisers_faculty_idx on public.thesis_advisers(faculty_id);
create index thesis_panel_faculty_idx on public.thesis_panel_members(faculty_id);
create index thesis_topics_topic_idx on public.thesis_topics(topic_id);
create index thesis_keywords_keyword_idx on public.thesis_keywords(keyword_id);
create index audit_thesis_idx on private.audit_logs(thesis_id, created_at);

-- Updating a record changes its timestamp and version, including trusted writes.
-- save_record must additionally lock/check expected_version before updating.
create function private.touch_thesis() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  new.version := old.version + 1;
  if old.status = 'archived' and new.status = 'published' then
    raise exception 'Restore this record to draft before publishing';
  end if;
  return new;
end;
$$;
create trigger touch_thesis before update on public.theses
for each row execute function private.touch_thesis();

-- Deferred validation permits atomic parent + ordered author writes.
create function private.validate_publication() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid; targets uuid[];
begin
  if tg_table_name = 'theses' then
    targets := array[new.id];
  elsif tg_op = 'INSERT' then
    targets := array[new.thesis_id];
  elsif tg_op = 'DELETE' then
    targets := array[old.thesis_id];
  else
    targets := array[old.thesis_id, new.thesis_id];
  end if;
  foreach target in array targets loop
    if exists (select 1 from public.theses t where t.id = target and t.status = 'published')
      and not exists (select 1 from public.thesis_authors a where a.thesis_id = target) then
      raise exception 'Published records require at least one author';
    end if;
  end loop;
  return null;
end;
$$;
create constraint trigger publication_has_authors
  after insert or update on public.theses deferrable initially deferred
  for each row execute function private.validate_publication();
create constraint trigger authors_preserve_publication
  after insert or update or delete on public.thesis_authors deferrable initially deferred
  for each row execute function private.validate_publication();
revoke all on function private.touch_thesis() from public, anon, authenticated;
revoke all on function private.validate_publication() from public, anon, authenticated;

-- Explicit grants: browser roles have SELECT only. No direct mutation grants.
do $$
declare n text;
begin
  foreach n in array array['academic_years','sources','theses','thesis_authors',
    'faculty_members','thesis_advisers','thesis_panel_members','topics',
    'thesis_topics','keywords','thesis_keywords'] loop
    execute format('alter table public.%I enable row level security', n);
    execute format('revoke all on public.%I from public, anon, authenticated', n);
    execute format('grant select on public.%I to anon, authenticated', n);
    execute format('create policy admin_read on public.%I for select to authenticated using ((select private.is_admin()))', n);
  end loop;
  foreach n in array array['author_identifiers','import_batches','import_rows','audit_logs'] loop
    execute format('alter table private.%I enable row level security', n);
    execute format('revoke all on private.%I from public, anon, authenticated', n);
  end loop;
end;
$$;
create policy published_theses on public.theses for select to anon, authenticated
  using (status = 'published');
create policy published_sources on public.sources for select to anon, authenticated
  using (exists (select 1 from public.theses t where t.source_id = sources.id and t.status = 'published'));
create policy published_academic_years on public.academic_years for select to anon, authenticated
  using (exists (select 1 from public.theses t where t.academic_year_id = academic_years.id and t.status = 'published'));

-- All association policies depend only on theses, preventing recursive policies.
do $$
declare n text;
begin
  foreach n in array array['thesis_authors','thesis_advisers','thesis_panel_members','thesis_topics','thesis_keywords'] loop
    execute format('create policy published_associations on public.%I for select to anon, authenticated using (exists (select 1 from public.theses t where t.id = %I.thesis_id and t.status = ''published''))', n, n);
  end loop;
end;
$$;
create policy published_faculty on public.faculty_members for select to anon, authenticated
  using (exists (select 1 from public.thesis_advisers a join public.theses t on t.id = a.thesis_id
    where a.faculty_id = faculty_members.id and t.status = 'published')
  or exists (select 1 from public.thesis_panel_members p join public.theses t on t.id = p.thesis_id
    where p.faculty_id = faculty_members.id and t.status = 'published'));
create policy published_topics on public.topics for select to anon, authenticated
  using (exists (select 1 from public.thesis_topics x join public.theses t on t.id = x.thesis_id
    where x.topic_id = topics.id and t.status = 'published'));
create policy published_keywords on public.keywords for select to anon, authenticated
  using (exists (select 1 from public.thesis_keywords x join public.theses t on t.id = x.thesis_id
    where x.keyword_id = keywords.id and t.status = 'published'));

comment on column public.theses.source_archive_id is 'Original CSV archive_id; unique only within its source.';
comment on column public.theses.source_created_at is 'Original export timestamp without timezone; not thesis completion time.';
comment on column public.theses.group_code is 'Source identifier stored as text; not globally unique.';
comment on table private.import_rows is 'Private source snapshots and review state; never exposed as public thesis data.';
commit;
