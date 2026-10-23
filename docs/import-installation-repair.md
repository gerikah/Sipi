# CSV import installation repair — 23 October 2026

## Cause and repair

The development API returned `PGRST202` for `stage_import` and `list_imports`. A database catalog inspection confirmed that the import functions and four import tracking columns were absent. The newer content-scope migration had installed `private.import_row_errors`, but it does not install the earlier transactional import workflow. This was a missing installation, not an invalid CSV or missing source.

Added `supabase/migrations/20261023090001_repair_import_installation.sql`. It installs the original transactional import functions with `CREATE OR REPLACE`, adds missing columns without replacing existing data, retains the latest raw student-number validation, reapplies restricted execution grants, and requests a PostgREST schema reload. Earlier migrations remain unchanged. The repair also works when the original imports migration is already installed and can be rerun safely.

Applied this repair through the trusted Supabase connector to the explicitly authorized development project. The connector recorded it as `20261023030535_repair_import_installation`; the local filename sorts after the existing content-scope migration. No thesis records, batches, sources, or memberships were created or changed.

The dialog now distinguishes an unavailable import API (`PGRST202`) from a missing database helper (`42883`). Both messages identify import setup as the problem and explain that local file selection and corrections remain intact.

## Verification

- All 21 disposable database checks passed, including installation with both earlier discovery/import migrations skipped, repeat repair, identifier privacy, publication requirements, duplicate review, retry idempotency, and forced rollback.
- All 11 relevant browser checks passed across the initial run and focused rerun. The two new tests initially used the wrong button label; corrected to the existing “Validate and preview” control and reran successfully. Both missing-function errors retain the CSV and reviewed names. Existing staged-batch recovery, keyboard checks, light/dark themes, and desktop/mobile layout checks pass.
- Lint, TypeScript, production build, and browser environment leak check passed. The existing bundle-size warning remains (approximately 596 kB before gzip).
- Hosted API schema exposes all five import endpoints. Anonymous `list_imports` and empty `stage_import` probes return `42501`, rather than missing-function errors. SQL under the existing active administrator's authenticated role can list batches and resolves staging validation; empty input is rejected without creating a batch.
- Hosted thesis and batch counts stayed at zero. No real CSV data was sent. A complete signed-in hosted staging/commit flow was intentionally not performed; those operations were exercised with isolated local fixtures.

## Follow-up

The verified CPE Department Compendium source remains configured. After the repair, the existing browser session can retry Check duplicates; this stages reviewed CSV data and remains an administrator action. Reloading the page discards browser-only corrections, so do not refresh just to retry.

Migration history needs reconciliation before a future CLI deployment: the user manually applied content-scope SQL, which is not registered in hosted migration history, and the repair has a connector-assigned version. Do not blindly replay historical `CREATE FUNCTION` migrations over this installation. Compare definitions and record verified applied versions through the migration repair workflow first; no history entries were fabricated in this change.

Post-repair security review also flags authenticated execution of `public.list_imports`. This is intentional: the function checks active administrator membership, derives the actor from the session, and returns only that actor's batches. It remains unavailable to anonymous and unapproved callers ([advisory explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)).

Existing release advisories are separate from this fix: review the platform `rls_auto_enable` event-trigger function's execution grants ([Supabase advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)), [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), and [foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). Private tables intentionally deny direct access with RLS and no client policies; guarded functions provide access.
