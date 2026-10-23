# Sipi development instructions

## Project purpose

Build Sipi, a thesis record repository for the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila. The records come from a department compendium; the supplied mapping verifies academic years 2015-2016, 2018-2019 and 2019-2020 in the available subset, not continuous or full compendium coverage. The CSV is not imported in Phase 2.

Address the project owner as gerikah. Use plain words in interface copy and documentation.

## Read before implementing

1. Read this file for scope, architecture, phases and checks.
2. Read `docs/design.md` for the palette, typography, spacing, themes and layouts.
3. Read `docs/content.md` for screen copy, field placement and empty states.
4. Read `docs/database_schema.md` and `docs/phase-2-setup.md`; consult `docs/development-plan.md` if present and the seven wireframes in `docs/references/`.
5. Inspect the repository and its existing scripts before creating or replacing implementation files. Continue completed work; do not scaffold over it.

These files describe planned behavior, not verified implementation progress. Resolve conflicts in favor of gerikah's latest explicit instruction. Record material changes to scope or architecture in project documentation so the files stay aligned.

## Agreed stack

- React with TypeScript and Vite for the frontend.
- React Router for page navigation.
- Supabase PostgreSQL, Auth and JavaScript client for data and administrator login.
- PostgreSQL functions through RPC for transactional writes.
- Netlify for frontend hosting.
- Shared CSS variables for design tokens; Tailwind may consume those tokens if already selected in the repository.

This supersedes the earlier Laravel, Inertia, MySQL and XAMPP proposal. Do not reintroduce those services or another backend framework without a new project decision.

## Seven MVP page layouts

| Layout | Route | Notes |
| --- | --- | --- |
| Home | `/` | Centered logo and search; lower description, source note and approved image area |
| Search Results | `/records` | Search toolbar, filters, sort, record card grid and pagination |
| View Record | `/records/:id` | Supporting results on the left; selected record and metadata on the right |
| About section | `/#about` | Below Home on the same page; three supplied illustrations and department/source copy, without a repeated logo. `/about` redirects here. |
| Admin Login | `/admin/login` | Image area and login panel; email and password only |
| Record Management | `/admin/records` | Horizontal navigation, toolbar, status tabs and records table |
| Add or Edit Record | `/admin/records/new`, `/admin/records/:id/edit` | Reuse the same large form layout for both states |

Public navigation is Home, About and Records, with a theme toggle. About scrolls to the section below Home; Records opens `/records`. Admin Login is accessed directly at `/admin/login` and is not in the public navigation. This follows gerikah's navigation revision of 22 October 2026.

Import CSV, Help, classification editing, record review and confirmations are dialogs inside these layouts. Keep the administrator navigation horizontal. Do not add separate dashboard, analytics or user management pages to this MVP.

Later scope: PDFs and downloads, student accounts and submissions, faculty/staff roles, advanced analytics and AI recommendations.

## Design and content requirements

- Preserve gerikah's wireframe structure; do not redesign the navigation or replace the form with a narrow drawer.
- Use Quicksand headings and Nunito body text.
- Use the palette and readable light/dark theme assignments from `docs/design.md`.
- Font sizes, line heights, spacing, radii and fixed control dimensions use multiples of 8px. Borders and focus strokes may use the explicit 1px and 2px exceptions in `docs/design.md`.
- Keep shared headers, search controls, cards, form fields and dialogs consistent.
- Support keyboard navigation, visible focus, mobile layouts, loading, empty and error states.
- Do not invent thesis records, totals, years, images, contacts or official endorsements. Keep source years pending until verified.
- Use empty data states in the running interface. Bracketed placeholders belong in design specifications, never in stored records.
- Isolated test fixtures may exercise logic but must never populate the public demo, production data or screenshots as purported department records.

## Data and access boundaries

Visitors can read published records without accounts. Approved active administrators can create, edit, publish, archive and restore records to draft. Disable public signup. Authentication alone does not grant administrator access.

Use Supabase Auth for credentials. Store an administrator membership linked to `auth.users`; only trusted administrative operations may change membership. Check `auth.uid()` against active membership on every protected database operation. Disabled administrators lose write access even with an existing session.

Enable Row Level Security on exposed tables and set database grants deliberately. Deny anonymous writes. Protect draft and archived records and their related metadata. Public access to a related author, adviser or tag must be justified by a published thesis relationship. Keep staged imports and audit logs private. A hidden button or route is not an authorization control.

Prefer `SECURITY INVOKER` read functions. Any `SECURITY DEFINER` function must validate administrator access, qualify table names, set a safe `search_path`, validate inputs and restrict execution grants. Actor identities come from the verified session, not request payloads. Do not expose role changes or hard deletion through the app.

Only the Supabase URL and publishable key belong in browser configuration. Never put service role keys, secret keys, database passwords or source CSV files in the frontend bundle or Git. Keep a sanitized `.env.example` with variable names. Update `.gitignore` for the chosen frontend stack and local tooling.

## Logical data model

| Tables | Responsibility |
| --- | --- |
| `auth.users`, `private.administrators` | Managed credentials and approved active admin membership |
| `theses` | UUID, unique repository code, metadata, status, source, version and timestamps |
| `thesis_authors` | Per-thesis names and author order; no guessed global identity |
| `faculty_members`, `thesis_advisers`, `thesis_panel_members` | Reviewed faculty identities and ordered associations |
| `topics`, `thesis_topics` | Controlled topics and associations |
| `keywords`, `thesis_keywords` | Normalized keywords and associations |
| `academic_years` | Adjacent start/end years; full display label |
| `private.author_identifiers` | Optional student identifiers, never public |
| `sources` | Compendium label, nullable coverage years and verification flag |
| `private.import_batches`, `private.import_rows` | Mapping, staged data, validation, review and commit result |
| `private.audit_logs` | Trusted record of actor, action, changed fields and timestamp |

Use migrations under `supabase/migrations`. Enforce foreign keys, unique association pairs, author ordering and allowed statuses. Do not treat people's names as unique identities. Keep source coverage separate from thesis academic year.

## Record lifecycle and database operations

New and imported records start as drafts. Drafts may be incomplete, but supplied values must be valid. Publishing requires title, academic year, at least one author and a selected source. Abstract, advisers, topics and keywords remain optional until the CSV establishes available metadata.

Allowed transitions: draft to published or archived; published to draft or archived; archived to draft. Publishing always rechecks requirements. Preserve associations when archiving. Use a version value to reject stale edits.

- `search_records(q, year_from, year_to, topic_id, sort, page)`: published results only; search metadata and related names; apply filters before counts and pagination; return distinct theses; cap page size at 24 and use a stable final ID sort key.
- `save_record(payload, expected_version)`: validate administrator access and save record, associations and audit entry atomically.
- `set_record_status(id, status, expected_version)`: verify access, transition, version and publishing fields; record an audit event.
- `commit_import(batch_id)`: lock the staged batch, revalidate selected rows, insert drafts and associations, write audit events and mark the batch complete in one transaction.

Preserve query, filters, sort and page when opening a record or navigating Back. Public detail access must not reveal unpublished records by guessed IDs. Clear protected interface data on logout.

## CSV import rules

Use `docs/database_schema.md` for the supplied CSV mapping. Preserve ordered authors/advisers, group codes, section blocks, archive IDs and timestamps without guessing a timezone. Reinspect the actual CSV before Phase 5 splitting and import; missing values stay empty and student numbers remain private. Broader compendium coverage still requires independent verification.

The import dialog has six steps: Select CSV, Map columns, Validate rows, Review duplicates, Confirm rows and Import summary. Implemented limits are 2 MiB and 200 rows per batch, reduced from the proposed 500 after local measurements; hosted performance remains to be checked. Parse UTF 8 CSV in the browser and stage normalized rows for database revalidation. Preserve original row references and author order.

Invalid rows cannot be selected. Flag possible duplicates using normalized title, year and authors. Require correction or skipping; do not silently merge or overwrite. Enforce row validity again at commit, regardless of browser validation.

Commit all selected eligible rows in one transaction. A completed batch returns its existing summary when retried. On an uncertain network result, query batch status before retrying. Forced failure must leave no partial thesis inserts. Summary counts come from stored results. Remove raw file contents from browser memory when finished.

## Implementation phases

Implement in this order and verify each exit check. Do not assume a phase is complete merely because it appears in this list.

### Phase 1 Project foundation

Build the app structure, routes, shared layouts, fonts, themes and seven page layouts. Use empty states. Set up a Netlify preview with nonproduction Supabase configuration.

Exit: navigation, direct links, refresh, theme persistence and responsive layouts work.

### Phase 2 Database and administrator access

Add migrations, policies, grants, administrator checks and transactional write functions. Implement login, logout, sessions and denied states.

Exit: visitors and unapproved authenticated users fail direct write requests and cannot read drafts; approved administrators succeed; disabled administrators fail writes.

### Phase 3 Record management

Connect the table, metadata form, ordered authors, draft save, review, publishing, archive and restore. Add classification dialogs, unsaved edit protection and version conflicts. Keep Import CSV unavailable until implemented.

Exit: the full record lifecycle works and relationships and audit history remain consistent.

### Phase 4 Public discovery

Connect search, filters, sorting, cards, pagination and record details. Apply `docs/content.md` copy and preserve search context.

Exit: a published record is discoverable and shareable; unpublished IDs remain unavailable; loading, empty and query failure states work.

### Phase 5 Compendium import

Inspect the real CSV, confirm mapping and source coverage, implement review and transactional commit.

Exit: valid drafts import, invalid rows are explained, duplicates require review, retry creates nothing extra and rollback leaves no partial inserts.

### Phase 6 Release checks

Verify permissions, lifecycle, search and import behavior. Review accessibility, themes, mobile layouts and long content. Configure production hosting and authentication. Document backups and rehearse a restore.

Exit: acceptance checks pass against the deployed environment with approved data and documented recovery steps.

## Checks before completing a change

Use the scripts actually present in `package.json`; do not claim commands or tests exist before checking. Run the relevant type checking, lint, build and behavioral tests for the change. Add focused tests for permissions, transactional imports, lifecycle transitions and stale edits. Avoid tests that only repeat static markup.

For UI changes, compare the affected layout with the supplied wireframe and check both themes, keyboard access, narrow widths, long content and empty/error states. Do not add mock records just to make a page look populated.

For database changes, verify direct API allow/deny behavior, related metadata visibility and transaction rollback. For imports, verify repeat commit behavior and duplicate review.

For deployment changes, use `npm run build`, publish `dist` and configure the SPA rewrite to `index.html`. Verify direct detail and admin links after refresh. Use nonproduction Supabase data for previews and configure production Auth URLs separately. Do not mark backup recovery complete without a restore check.

Report what changed, what was verified and any remaining dependency, such as the missing CSV. Keep phase progress and unresolved decisions documented in the repository's existing tracking system; do not invent completed work.

## Current implementation tracking

See `docs/phase-4-5-review.md` for locally implemented public discovery and CSV importing, pending migrations and release gates. The actual CSV is absent from this checkout and available attachments, so mapping and name separators still require verification against the real file. Importing never publishes records. Do not treat the feature implementation as authorization to import remote content.
