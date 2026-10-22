# Phase 2 setup and verification

Historical Phase 2 notes below are superseded where applicable by [Phase 3 review](phase-3-review.md). gerikah subsequently authorized the connected development project, the pending migrations were applied, and record management is connected. The source catalog is still empty.


## Current state

Phase 2 code is implemented locally. The connected Sipi project's `public` and `private` schemas and migration history were inspected read-only on 22 October 2026; no application tables or migrations existed. No remote schema, Auth settings, accounts, or records were changed. The supplied `sipi_schema.sql` remains unchanged as a reference; its exact contents form the first migration. Do not apply both files.

The second migration adds transactional record functions and hardens grants. Browser roles cannot write tables directly, assign administrator membership, read private identifiers, or read staging/audit tables. Published records and their related metadata are public; active administrators may also read drafts and archived records. Private data has no browser table grants even for administrators. No records, academic-year rows, sources, or accounts are seeded.

Login uses Supabase Auth followed by `is_admin()`. Routes remain closed until both checks pass. Access is rechecked on focus, visibility changes, Auth events and every 30 seconds while visible. Revocation or a failed check unmounts the workspace and its local input. Database operations independently check live membership on every call. This interval is a UI refresh policy, never an authorization boundary.

Record forms, table reads, public record queries and CSV import remain disconnected. Phase 3 will connect record management; Phase 4 will connect public discovery; Phase 5 will implement import.

## Environment

Copy `.env.example` to `.env.local` if an environment file does not already exist. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to a local or approved development project. Restart Vite after changes. The existing `.env` is ignored by Git and was left unchanged. Its names were inspected without printing values; its secret/JWKS entries are not used by the application.

Vite disables automatic environment exposure and explicitly maps only the URL and publishable key to the client. Existing `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` aliases are supported, as is `SUPABASE_ANON_KEY` for legacy anon keys. Key validation rejects secret/service-role keys without including their values in errors. Do not put secrets, database passwords or source files in any frontend variable, Netlify build variable, or Git. No secret key is required for this app.

Missing or invalid URL configuration leaves the public interface usable and login unavailable. The SDK persists the session under `sipi-auth`; when browser storage is blocked it uses memory. Logout clears local credentials even when server revocation cannot be confirmed. Issued access tokens can remain valid until expiration; disabling membership immediately denies subsequent database writes. No public signup or password-reset flow is provided.

## Local migrations

The repository pins the Supabase CLI and includes `supabase/config.toml`. Local signup is disabled, seeding is disabled, and `private` is not exposed through the API.

With Docker installed and running, from this directory:

```sh
npx supabase start
npx supabase migration up --local
npm run test:db
```

The CLI starts its local stack and applies pending migrations; `migration up --local` is safe when already applied. Do not use a remote database URL or `db push` for these steps. `db reset --local` is destructive to the local database and is unnecessary for ordinary pending migrations. Create future migration files with `npx supabase migration new descriptive_name`; never edit applied history.

For an authorized development deployment, first compare its schema and migration history again, then apply these migrations using the team's reviewed deployment procedure. If someone has already applied `sipi_schema.sql` manually, compare the complete definition and reconcile the baseline migration history before applying the second migration. Do not rerun the baseline or drop tables to resolve drift. No remote project has been linked or authorized for writes by this task.

## Required dashboard settings and first administrator

Apply these settings separately in the approved development project before testing login:

1. Authentication → Sign In / Providers: disable **Allow new users to sign up**. Keep anonymous sign-ins disabled. Enable email/password login. Local config does not change hosted settings.
2. Authentication → URL Configuration: set the development Site URL and exact allowed URLs for the local/preview host. Configure production URLs separately; avoid broad production wildcard redirects.
3. API settings: expose only intended schemas; keep `private` unexposed. Keep automatic grants on new application tables disabled where available. Migrations explicitly revoke/grant access regardless of defaults.
4. Create or invite the first administrator through trusted Supabase Auth administration. For password login, securely complete account confirmation and password setup using the organization's approved process. There is no invitation-completion UI in Sipi yet. Never commit or send a password through the app's SQL.
5. Copy the verified Auth user's UUID, then run the following through a trusted SQL administrator connection. Replace the marker before execution; do not use user-editable metadata to approve access.

```sql
insert into private.administrators(user_id, active)
values ('<verified-auth-user-uuid>'::uuid, true);
```

To disable an administrator, use a trusted SQL connection with a specific user ID:

```sql
update private.administrators set active = false
where user_id = '<verified-auth-user-uuid>'::uuid;
```

Membership writes serialize with in-flight record writes. Once a disable transaction commits, subsequent writes fail even with an existing access token. Also revoke Auth sessions through trusted administration when appropriate. No browser-facing operation can create or alter membership.

## Record RPC contract for Phase 3

`save_record(payload jsonb, expected_version integer)` creates a draft if `id` is absent/null and expected version is null. Editing requires the existing UUID and exact version. It locks the parent, validates supplied fields, updates the parent once (including child-only edits), replaces supplied relationship lists, and appends an audit event atomically. Omitted fields/lists retain existing values. Empty lists remove associations. Archived records must first be restored to draft.

Allowed scalar keys: `id`, `title`, `academic_year_id`, `source_id`, `source_archive_id`, `source_row_number`, `group_code`, `section_block`, `abstract`, `source_created_at`. Year/source UUIDs must already exist; trusted administration or a future approved classification flow supplies them. Missing text stays null. Original archive IDs and row numbers are positive whole numbers. Source timestamps accept an ISO date/time without a timezone; no timezone is guessed. Group codes remain text.

Relationship keys:

- `authors`: ordered `{ full_name, id? }` entries. Reuse existing IDs when reordering/editing to preserve private identifiers. IDs must belong to this thesis. Removing an author also removes that author's private identifier by the supplied schema's cascading FK.
- `advisers`, `panel_members`: ordered `{ faculty_id }` entries for reviewed existing identities, or `{ display_name }` for a new identity. Equal names are never automatically merged. Shared faculty names are not renamed through this call. Reuse returned/queryable faculty IDs on subsequent saves.
- `topic_ids`, `keyword_ids`: unique existing UUIDs. This phase does not implement classification creation.

Objects reject unknown/protected keys, including status, actor and version fields. Payloads are capped at 256 KB and each relationship list at 100 entries. Returned data is `{ id, version, status }`. `audit_logs.changed_fields` lists submitted field names, not a before/after value diff; raw or private values are not recorded there.

`set_record_status(id uuid, status text, expected_version integer)` permits draft → published/archived, published → draft/archived, archived → draft. Same-status requests are rejected; clients must reload after uncertain outcomes. Publication requires title, academic-year FK, source FK and at least one author. Archiving preserves associations. Both functions use the verified caller as actor, return SQLSTATE `42501` for denied access, `40001` for stale versions, and validation/constraint errors for invalid input. Failed calls roll back metadata, relationships and audits together; identity sequence gaps are normal.

Public RPCs are invoker wrappers around restricted private definer functions with empty search paths and qualified names. The membership lookup and invariant publication trigger are narrowly scoped exceptions to a write RPC's explicit administrator guard: one answers only caller membership, and the other enforces publication constraints via table triggers. Neither allows arbitrary data access or mutation.

## Verification and remaining gates

`npm run test:db` applies both migrations to a fresh, disposable PGlite PostgreSQL engine with test-only Auth roles and `auth.uid()` claims. It exercises actual SQL grants, RLS, functions, deferred constraints and rollback with isolated fixtures. Tests simulate permissive Supabase default grants so explicit revocations are checked. These fixtures never enter the running app or remote database.

`npm test` builds an isolated browser bundle under `.local/test-dist`, with a loopback-only test URL and mocked Auth/membership responses. It checks real UI navigation, session restoration, credential errors, denied/revoked access, expired sessions, connection errors, logout, local data clearing and redirect safety. Foundation tests check light/dark modes, keyboard dialogs, desktop/tablet/mobile widths, direct links and refresh, and accessibility. This is not a live Auth or PostgREST test.

Docker and system PostgreSQL are not installed here. Full local Supabase services, SQL advisors against the migrated full stack, concurrent sessions, actual email/password login, token refresh/revocation, and direct HTTP allow/deny checks remain unverified. The remote project remains read-only and empty, so a real account cannot pass its membership check until migrations and administrator provisioning are completed in an authorized development environment.

Verification on 22 October 2026: type checking, ESLint, production build, environment/build secret check, all 11 browser tests and the database suite (five behavioral subtests plus their parent) passed. Desktop 1440px, tablet 768px and mobile 390px screenshots were generated in both themes; login and mobile workspace screenshots were visually reviewed against the supplied layout. The initial broken logo import was corrected to its reorganized `public/images/` location. The build reports a nonfatal chunk-size warning (about 556 KB before compression); code splitting can be addressed with later integration. `supabase db advisors --local --type all --fail-on error` could not connect: `ECONNREFUSED 127.0.0.1:54322`. No full-stack advisor pass is claimed.

Before accepting Phase 2's deployment exit gate, run the following against that environment with separate visitor, ordinary user, active administrator and disabled-administrator sessions: public/private reads and related metadata, RPC allow/deny calls, direct write denials, self-membership denials, stale writes from two sessions, failed multi-table saves, publication validation, and login/refresh/logout/revocation. Confirm hosted signup is actually disabled. Keep isolated fixtures out of application/production records and remove development fixtures after verification.

Phase 3 code integration can build on these contracts; live acceptance remains gated on the checks above. Import functions, CSV loading and source rows are not part of Phase 2.

## References

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database function security](https://supabase.com/docs/guides/database/functions)
- [Auth callback deadlock guidance](https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0)
- [Supabase changelog](https://supabase.com/changelog), reviewed during implementation.

## Supplied asset follow-up, 22 October 2026

The shared logo now uses `Logo Word.png`; the extra About logo was removed. The Home description and three About slots use the four supplied research illustrations from `public/images/`. The login image area remains reserved. Responsive sizing preserves image proportions and the wordmark remains visible in both themes.

## Login diagnosis follow-up

A read-only check found that the baseline schema has now been applied manually to the connected project, with no migration history registered. The confirmed Auth user had signed in successfully, but `private.administrators` was empty. This explains the access denial; creating an Auth user does not grant administrator membership. No baseline migration should be reapplied. Save/status RPCs were not present in that check; Phase 3 still requires the additive migration and baseline history reconciliation. gerikah explicitly approved the one-user membership change. It was applied to the confirmed Auth account, and `public.is_admin()` returned true under that user's authenticated role and claims in a read-only verification transaction. No records, schemas or other accounts were changed. This verifies database membership; an interactive password login was not performed by the agent.
