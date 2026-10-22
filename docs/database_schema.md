# Sipi database schema

## Scope and status

This schema is based on the supplied `cpe_thesis_repository.csv` and the Sipi MVP development plan. It replaces the earlier assumption that the compendium contains a single completion year for each thesis.

`sipi_schema.sql` is a schema foundation for a new Supabase project. It creates tables, indexes, read policies, an administrator membership check, version/timestamp maintenance and publication safeguards. It imports no records and creates no administrator accounts.

Before using it in a repository where Phase 2 migrations already exist, compare names and relationships and write an incremental migration. Do not run it over existing tables or drop existing data. Apply once through a development migration before production.

Direct application table writes remain disabled. The second migration implements save/status RPCs; record forms are connected in Phase 3, while import remains for Phase 5. The authorized development database now has the four repository migrations; see `phase-3-review.md`. The baseline and additive RPC migration are now verified in disposable PGlite PostgreSQL tests; full Supabase Auth/PostgREST checks remain pending. See [Phase 2 setup](phase-2-setup.md).

## What the CSV actually contains

- 142 rows with 142 distinct archive IDs and titles.
- Academic years: 2015–2016 (42 records), 2018–2019 (28), and 2019–2020 (72).
- The dataset has a gap: 2016–2017 and 2017–2018 are not represented. Do not claim continuous coverage from 2015 to 2020.
- All 142 rows have author lists. Preserve their order and review splitting before committing.
- 70 group codes are literal `NULL`; group codes are identifiers, not quantities.
- All student numbers are missing: 141 literal `NULL` values and one empty cell.
- All final panel values are literal `NULL`.
- The source has no dedicated topic or keyword columns. Some abstracts contain Keywords or Index Terms text; extraction requires review.
- `main_adviser` can contain multiple people, inconsistent spacing, name variants, punctuation errors or the value `No record`. It is not reliably one adviser per thesis.
- Source `created_at` values are export/database timestamps in 2026 without a timezone. They are not thesis completion dates.

Suggested truthful source note after confirming the source identity:

> Sipi contains thesis records from the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila, based on the available compendium records for academic years 2015–2016, 2018–2019, and 2019–2020.

Keep the original broader compendium coverage fields unset until that coverage is independently confirmed. This uploaded subset alone does not establish full compendium coverage.

## CSV mapping

| CSV column | Destination | Import rule |
| --- | --- | --- |
| `archive_id` | `theses.source_archive_id` | Preserve the original integer; unique with `source_id`, not the Sipi UUID |
| `thesis_title` | `theses.title` | Trim outer whitespace; preserve wording; similar title is a duplicate review signal |
| `group_code` | `theses.group_code` | Text; convert missing markers to SQL NULL; do not require global uniqueness |
| `batch_year` | `academic_years.start_year`, `end_year`; linked through `theses.academic_year_id` | Parse the full academic year, such as 2015–2016, into two integers; validate adjacent years |
| `section_block` | `theses.section_block` | Keep the source label as text; no separate sections table needed for the current MVP |
| `author_name` | `thesis_authors.full_name`, `author_order` | Split into reviewed ordered names; retain original list in private import data |
| `student_number` | `private.author_identifiers.student_number` | Create no rows for this CSV because every value is missing; never attach a future list to authors by guessed positions |
| `main_adviser` | `faculty_members`, `thesis_advisers` | Review splitting and identity matches; preserve full display names including titles |
| `final_panel_members` | `faculty_members`, `thesis_panel_members` | Create no panel rows for this CSV; keep support for future supplied values |
| `abstract` | `theses.abstract` | Preserve the source text; do not rewrite technical claims or strip keyword sections without review |
| `created_at` | `theses.source_created_at` | Preserve as timestamp without time zone; Sipi creates separate timestamptz audit fields |

Store the unchanged parsed CSV row in `private.import_rows.raw_payload` to preserve evidence for corrections. It is not publicly readable. Keep missing markers out of normalized fields. `source_row_number` means a CSV data record index starting at 1, excluding the header; embedded newlines mean this is not a physical text line number or compendium page number.

## Tables and relationships

| Table | Purpose |
| --- | --- |
| `auth.users` | Supabase managed login credentials; not created by this migration |
| `private.administrators` | Approved active administrator membership linked to Auth |
| `academic_years` | Start/end academic year and generated display label |
| `sources` | Compendium identity, department, campus and separately verified coverage |
| `theses` | Record metadata, source identity, academic year, status and version |
| `thesis_authors` | Names and ordering for one thesis; no automatic global author identity matching |
| `faculty_members` | Reviewed adviser or panel display names |
| `thesis_advisers` | Many advisers per thesis, with ordering |
| `thesis_panel_members` | Optional ordered panel members per thesis |
| `topics`, `thesis_topics` | Optional controlled topics and thesis associations |
| `keywords`, `thesis_keywords` | Optional reviewed keywords and associations |
| `private.author_identifiers` | Optional student numbers, separate from public names |
| `private.import_batches`, `private.import_rows` | Staging, source snapshots, review decisions and commit results |
| `private.audit_logs` | Trusted actor/action history without public source payloads |

A thesis belongs to one academic year and may reference one source. It has multiple ordered authors and may have several advisers, panel members, topics and keywords. An import batch has multiple staged rows; a committed row links to its created thesis.

The earlier global `authors` master table is simplified into per-thesis author entries because this CSV provides no reliable student identifiers for matching people across theses. A future verified person identity table can be added without guessing today.

Use an internal UUID for relationships. Keep the source archive ID for provenance and a separately generated numeric `repository_code` for Sipi display. Repository codes can have gaps and must not be treated as record counts.

## Data rules

### Missing values and identity

Normalize outer whitespace and literal missing markers such as `NULL`; treat `No record` as absent adviser information after review. Keep absent optional values null or empty relationships. Do not generate names or create records representing the word NULL.

Commas separate author lists in this export, but all splitting must retain order. Adviser commas are particularly unreliable: one source value uses a comma where a name initial punctuation mark would normally appear. Do not split every adviser comma blindly. Normalize repeated whitespace for matching, but do not merge different initials, spelling variants or honorific variants without review.

Keep group codes as text so future leading zeroes survive. Do not require title, person name or group code uniqueness. Enforce `(source_id, source_archive_id)` uniqueness to prevent the same source record being imported twice; possible duplicates across sources still require review.

### Publication and updates

Drafts can omit title, academic year, source or authors. Publishing requires a title, an academic-year link, a source, at least one author and a publication timestamp. This replaces the earlier mandatory completion-year rule: the CSV does not establish an actual completion date.

The row CHECK handles same-row requirements. Deferred triggers ensure a published thesis still has an author at transaction end, including when authors are removed or moved. Author and adviser ordering is unique per thesis and can be rearranged in a transaction.

`touch_thesis` updates version and timestamp. The save RPC locks the record and compares the supplied expected version before writing. A child-only edit must also update its parent thesis so its version changes. Do not increment versions separately in the client.

Restore archived records to draft before publishing again. Archive rather than expose hard deletion. Imported records remain drafts until reviewed.

### Search

The schema includes a PostgreSQL full-text index over title and abstract using the simple dictionary, plus year/status and relationship indexes. This is a foundation, not an implemented search API. Search by authors, advisers and keywords must join the related tables. Combine filters before counting and pagination; count distinct theses and use a stable ID tie-breaker.

The interface should now say Academic year and display the complete range. Do not relabel batch year as completion year. Sort by academic-year end/start plus ID. A future actual completion date must be stored separately and only when supplied.

## Access design

Anonymous visitors can select published records and related names, topics, keywords, academic years and source information. Active administrators can select internal public-schema records. Other signed-in users have the same published-only read access as visitors.

Both browser roles have SELECT grants only. No INSERT, UPDATE or DELETE grants or policies are provided. Sensitive tables are in `private`, have RLS enabled, and have no browser table grants. Keep `private` out of Supabase exposed schemas. Granting schema usage allows policy helper calls; it does not grant table reads.

`public.is_admin()` reports only whether the caller is an active administrator. Its private helper reads protected membership with a fixed search path. Provision the first Auth account and its administrator membership through trusted Supabase administration, not a public form. Disable public signup.

Do not put a service role key in Netlify frontend variables. Public project URL and publishable key can be used by the browser; policies remain the access boundary.

## Implemented and remaining database functions

Functions 1 and 2 are implemented in the second migration. The third migration adds protected administrator reads and classification saves. Public search and import belong to later phases. See the RPC contract in `phase-2-setup.md` before enabling management buttons:

1. `save_record(payload, expected_version)`: authenticate an active administrator; validate and lock; save metadata and all associations; touch parent version; write a trusted audit event in one transaction.
2. `set_record_status(id, status, expected_version)`: check caller, allowed transition, publication requirements and version; set publication timestamp when publishing; write audit history.
3. Import staging and review functions: enforce active administrator membership and batch ownership, validate payloads, return errors and duplicate candidates. Private tables are not directly accessible through the browser API.
4. `commit_import(batch_id)`: lock, revalidate selected rows, check source-ID duplicates, insert drafts and relationships, save result counts and mark complete in one transaction. Completed retries return the same result.
5. `search_records(...)`: return distinct published thesis data with academic-year filtering and stable pagination. The third migration implements `admin_records` with bounded pages and `admin_record` for the edit view.

Use explicit parameters, a fixed search path, qualified object names, limited EXECUTE grants and `auth.uid()` for any definer function. Never trust a payload's actor ID. Do not enable writes by simply granting browser roles full table access.

## Checks before applying

- [ ] Run the migration against a new local or development Supabase database.
- [ ] Confirm application migrations do not already define conflicting tables or functions.
- [ ] Verify all browser roles are denied writes, including administrator sessions until RPCs exist.
- [ ] Verify visitors cannot read drafts, their related names, private identifiers, staging or audit history.
- [ ] Verify `is_admin` returns false for ordinary users and disabled administrator memberships.
- [ ] Verify publishing without an author fails at transaction commit; atomic record plus author creation can succeed.
- [ ] Verify duplicate source archive IDs fail within one source and can coexist across distinct sources.
- [ ] Verify academic-year ranges, nulls, identifier types and source timestamps survive import without changing meaning.
- [ ] Test reordered authors and stale edit handling after the write functions are added.
- [ ] Test import retry and rollback after the commit function is added.

## References

- Source data: supplied `cpe_thesis_repository.csv`, 142 parsed CSV records.
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgreSQL constraints: https://www.postgresql.org/docs/current/ddl-constraints.html

Phase 3 browser-facing administrator reads represent bigint archive IDs and repository codes as decimal strings. The public save wrapper accepts archive decimal strings and converts them in SQL before the private transaction, preserving all bigint precision.
