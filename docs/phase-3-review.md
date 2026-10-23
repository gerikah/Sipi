# Phase 3 record management

Historical Phase 3 report. See [Phase 4 and 5 review](phase-4-5-review.md) for subsequent feature work and the [Phase 6 release checklist](release-checklist.md) for current hosted verification, migration differences and blockers.

## Delivered

The administrator table now loads real accessible records through `admin_records`. All, Drafts, Published and Archived views support search, academic-year start ranges, topic filtering, stable sorting, exact filtered totals and 24-record pages. Search matches title, abstract, repository code, group code, authors, advisers and keywords. Missing academic years sort last. Query parameters survive opening an edit form and returning to the table. Loading, empty, query failure and reload states are included.

The existing full-page add/edit layout now reads and saves metadata through the Phase 2 RPCs. It includes ordered authors/advisers/panel members, academic year, existing source selection, topics, keywords, abstract, group code, section block, original archive ID, source data row and source timestamp. No student identifier is queried or sent. Existing author IDs are retained to preserve private identifiers when names are reordered or edited. Changing a faculty name creates a separate identity; equal names are never automatically merged or used to rename a shared identity.

Academic years can be added explicitly from verified values. Topics and keywords can be created/renamed in dialogs; renaming checks the previous stored name to reject stale changes. Source creation is deliberately unavailable: choose a source already configured through trusted administration. All catalog rows are real; none are seeded. Catalog loading fails visibly at 1,000 choices instead of silently truncating data; larger catalogs need paginated selection in a later change.

Draft save, review/publish, return to draft, archive and restore to draft are connected. Status changes use confirmations and the expected version. Archived records are read-only until restored. In-flight requests disable repeated submissions. Tables reload after successful status changes. There is no hard deletion or public View action until public discovery is connected in Phase 4. Bulk selection/archive is not connected by this change; lifecycle actions apply to one record at a time.

## Transaction and editing behavior

Each metadata save is one atomic `save_record` call, including relationships, parent version and audit event. Publication follows as a separate version-checked `set_record_status` transaction, as required by the existing RPC design. If metadata saves but publication/readback fails, the interface says the save succeeded and requires inspecting the stored record before another write. It never reports publication as successful without a confirmed status/readback.

Unsaved changes trigger a navigation confirmation and browser unload warning. Stale version errors retain entered values, prevent another save and offer an explicit confirmation to replace them with the latest stored version. Definite validation errors preserve fields and allow correction. If a save result is uncertain after a network failure, the interface blocks blind retries; return to the table and inspect the stored result. New records have no idempotency key in the existing RPC, so this guard avoids generating duplicate records. No automatic write retry was added.

Only active administrators can use management read functions, even for published records. Invoker read functions retain RLS. Classification writes use a private definer function guarded by the same locked active membership check as record writes. Public wrappers are invoker functions with explicit authenticated-only execution grants. Direct table writes, administrator self-assignment and private-table reads remain denied. Logout/access loss unmounts all management state and pending responses cannot restore the workspace.

## Authorized development deployment

gerikah explicitly identified the connected Sipi project as a development database and authorized applying the pending migrations on 22 October 2026. The manually applied baseline was compared with a fresh local baseline: columns, nullability, constraints and RLS policy definitions matched. PostgreSQL 18 (PGlite) represents NOT NULL constraints separately; that catalog-only difference was excluded from the constraint comparison after checking the actual nullability match.

The baseline tables were preserved. `administrator_transactions` and `administrator_management` were applied through the Supabase migration API. The verified baseline was registered as applied, and the API-assigned versions for these newly applied migrations were aligned to their existing repository versions. History now contains:

- `20261022130506_schema_foundation.sql`
- `20261022130508_administrator_transactions.sql`
- `20261022135703_administrator_management.sql`
- `20261022141725_preserve_archive_identifier_precision.sql`

No prior local migration file was rewritten or renamed. The administrator membership was retained. No thesis, source, year or classification records were added to the connected project; no compendium was imported. Do not rerun `sipi_schema.sql` separately.

## Verification

Passed:

- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:env`.
- `npm run test:db`: six behavioral SQL subtests plus their parent. All four migrations run against a fresh disposable PGlite PostgreSQL database. Checks include role allow/deny behavior, public versus draft metadata, private identifiers, ordered relationships, provenance, atomic rollback, publication requirements, stale versions, restore transitions, disabled membership, pagination, filtered counts and classification conflicts.
- `npm test`: 14 browser tests. Three management tests route actual browser operations into a fresh disposable PostgreSQL database with test-only Auth claims. They verify create/edit/readback, author/adviser reordering, private identifier preservation, publication, archive/restore, filters, failed save preservation, explicit conflict reload, classification creation/selection and uncertain-save retry prevention. Fixtures are clearly named as isolated test data and exist only in memory; they never enter the configured project or public bundle.
- Remaining browser checks cover protected routes, session restoration/logout/revocation, keyboard dialogs, labels, light/dark contrast, direct links/refresh and desktop/tablet/mobile overflow. Empty form/table screenshots at 1440px and 390px were visually reviewed against the existing layout. No mock department records were created for screenshots.
- In the authorized development database, a read-only transaction using the approved administrator's role and claims returned `is_admin=true`, an empty `admin_records` result and a null new-record lookup.
- Actual anonymous HTTP calls returned published reads with HTTP 200 and no rows; administrator reads, `save_record`, and direct thesis insertion were denied with SQLSTATE `42501` (HTTP 401). These checks created no records.

An additional incremental migration preserves PostgreSQL bigint identifiers as decimal strings in administrator reads. The save wrapper converts archive ID strings to bigint inside PostgreSQL, so values up to 9223372036854775807 survive the browser without rounding. SQL tests cover the maximum value and reject overflow. Original Phase 2 migrations remain unchanged.

The production build has a nonfatal chunk-size warning (about 573 KB before compression). No secret values were printed or placed in the frontend configuration.

## Remaining dependencies and limits

The development source catalog is empty. Drafts can be saved without a source; publishing requires an existing, verified compendium source. Supply its actual name and details through trusted administration rather than inventing one. No initial year/topic/keyword rows have been seeded; administrators may explicitly add verified classifications through the form.

Actual email/password login and authenticated HTTP writes with a real user session were not performed by the agent. Real write behavior was exercised through disposable PostgreSQL and browser integration tests; the hosted administrator check/read RPCs were verified with database roles and claims. Docker/full local Supabase remains unavailable. Cross-process simultaneous edits and live token refresh still require a full-stack acceptance check; sequential stale-version behavior is covered.

Security advisors ran against the development project. Existing notices remain for the platform-created `public.rls_auto_enable()` helper's browser execution grants ([anonymous execution guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated execution guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)) and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Those pre-existing platform/Auth settings were not changed during record management implementation. The five private-table “RLS enabled, no policies” informational notices match the deliberate no-browser-access design, with table grants revoked. No passing advisor report is claimed.

Phase 4 can now connect public search/cards/detail views to published-only queries while preserving context. CSV import remains disabled for Phase 5. Production deployment, verified content loading, backup/restore and final release checks remain later work.
