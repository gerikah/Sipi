# Phase 6 verification and release preparation

## Reading-layout follow-up, 23 October 2026

Subsequent neutral-panel revision: replaced the lilac/blue detail backgrounds with the existing muted surface in each theme. Source now occupies the right column at the same width as Record details; Tags occupies the left column of the same row. Mobile stacks these sections. Added a local SVG paper-grain tile, soft card shadows, brief page/panel entrances and selected-tab feedback. No animation depends on remounting routes or changing form state. Reduced motion disables motion and transitions. An initial opacity entrance reduced contrast while animating; replaced it with movement at full text opacity and immediate palette changes.

Neutral-panel verification: nine foundation, motion and reader browser checks passed after the contrast adjustment; seven import-feedback checks also passed, covering state preservation during dismissal. Desktop/mobile screenshots in both themes confirm panel widths and Source/Tags alignment. Lint, type checking, production build, environment scan and whitespace checks passed. These are local checks, with no remote writes or deployment.

Gerikah's subsequent UI revisions are implemented locally: the requested combined 2015-2020 source note appears in About, redundant Home/About copy is removed, cards use compact content rows, and the details/source boxes use the existing lilac/blue theme pairs. Public authors and advisers appear on separate lines, preserving order and punctuation within each name. The public detail label is Adviser. The grouping disclosure is removed; automatic labels remain.

The source file contains 142 abstracts (323–3,103 characters); 139 contain export line breaks and 39 contain blank-line paragraph breaks. Presentation now joins single line wraps, preserves paragraph boundaries and separates labeled keyword/index sections without changing stored text. All 142 abstracts were rendered at 1440px and 390px (284 checks), with alternating themes: every word/punctuation mark was preserved apart from whitespace layout, and each ending remained reachable by scrolling. This establishes complete rendering of supplied content, not completeness of the original research document. Card previews remain intentionally short; opening a record shows the complete supplied abstract.

All six targeted browser scenarios passed after fixing a missing text separator in the new adviser layout. Reader checks include keyboard scrolling, name lists, source access, mobile/desktop and axe checks in both themes. About and card screenshots were visually inspected. Lint, TypeScript, production build, environment scan and whitespace checks passed. Design source lint passed; the separate design inspector timed out at `Page.enable`, so no successful inspector result is claimed. Playwright provided the completed rendered checks. No database, source text, production settings or deployment changes were made.

Reviewed 23 October 2026. **Phase 6 remains open.** The current deployment is not ready for normal use until the blockers in [release-checklist.md](release-checklist.md) are resolved. That checklist supersedes old deployment-status paragraphs in earlier phase reports; those reports remain historical evidence.

## Work completed

- Inspected the project instructions, design/content/schema/source reviews, phase reports, migrations, transactional functions, authentication, forms, import dialog and supplied layouts. Continued the existing implementation without scaffolding over it.
- Compared actual live database objects and history with a disposable schema built from the original eight migrations. Identified public actor-column grants, an administrator projection that relies on those grants, a missing unused legacy read function and an alternate recorded import-repair version. No remote history was changed.
- Prepared `20261023081324_release_access_hardening.sql` as a new additive migration. Its regression reproduces live permission drift and verifies the repair, including repeated application and owner event-trigger operation. It is **not deployed**.
- Added repeatable read-only hosted/API/browser checks, schema audit/export tools, an isolated import timing script, a guarded retention scheduling script, a local backup/restore regression, and recovery/migration instructions.
- Split public, login, administrator table, record form and CSV import features into separate chunks. CSV code loads when its dialog is opened. React and Supabase have separate cacheable vendor chunks. The main application chunk is about 109 KB instead of one roughly 612 KB local bundle; total JavaScript remains about 616 KB. This defers approximately 50 KB of administrator/import features on public routes and removes the single-chunk warning, rather than claiming the total download shrank to 109 KB.
- Preserved the latest supplied AGENTS.md scope: source-only stored thesis content, source-derived discovery tags and automatic grouping with evidence, no topic/keyword form inputs, no generated thesis summaries. Added regression coverage for term evidence, currency ambiguity, public-only facets, pagination, multi-filter matching and catalog bounds.
- Inspected desktop/mobile screenshots in both themes, including the fixed local reader, long text, consistent cards and import errors. Local structure retains the supplied supporting-results/detail layout, with the later approved navigation and scroll revisions. Hosted screenshots demonstrate an older frontend: a visible Search records heading, older card content and outer detail-page scrolling.

## Verification results

| Check | Result and scope |
| --- | --- |
| `npm run lint` | Passed, zero warnings. |
| `npm run build` | TypeScript and production build passed; no chunk-size warning. |
| `npm run check:env` | Passed; environment files ignored and configured sensitive values absent from `dist`. Explicit two-variable Vite allowlist preserved. |
| `npm run test:db` | 23 database/parser/recovery/hardening checks passed; subsequently four added term-unit checks passed with `node --test tests/database/terms.test.mjs` (27 total checks). Disposable PGlite only. |
| `npm test` | Full 32-test browser run passed. Afterwards the three source-term tests passed (two newly added), and eight reader/import-feedback tests passed again. 34 distinct browser scenarios verified, with isolated fixtures or Auth mocks, not hosted administrator sessions. |
| `node scripts/measure-import.mjs` | 142 synthetic drafts in a disposable engine: stage 937ms, review 835ms, commit 1,280ms, total 3,053ms. The initial synthetic titles triggered legitimate duplicate warnings; fixed-width unique fixture titles were used for this timing. No real CSV staging. |
| `node scripts/export-schema-audit.mjs` | Nine local migration files build successfully; 16 tables and 33 application functions exported as metadata. No remote connection. |
| `node scripts/verify-hosted.mjs` | Read-only actual Netlify/Supabase API checks succeeded, while reporting failed release conditions. Six public pages cover all 142 published records; fields match the local CSV with zero aggregate mismatches. Source coverage remains unset. Actor-column permission probe succeeds when it should be denied; public signup is enabled. This diagnostic reports findings rather than treating all HTTP 200 responses as acceptance. |
| `node scripts/verify-hosted-browser.mjs` | Actual fresh browser at 1440/390px, light/dark: records/detail/login refresh, protected signed-out redirects and unavailable ID checked. No page errors, horizontal overflow or axe A/AA violations. No login or remote write performed. |
| Supabase trusted read-only SQL | Compared catalogs/history, inspected aggregate data, membership guard behavior, source, author order, retention permissions and schedule absence. Approved/nonmember role-claim tests are not real JWT/Auth tests. |
| Supabase advisors | Rechecked security and performance. Unresolved findings are listed in the release checklist. |
| `git diff --check` | Passed; existing Windows line-ending notices are informational. |

Reports and screenshots are in ignored `.local/release/` and `test-results/`. The environment file was used without printing values. The original CSV remains ignored; public-source comparisons are performed in memory and only aggregate findings are retained in the report.

## Current hosted snapshot and blockers

The live bundle and local configuration point to the same database. There are 142 published theses, one active administrator, zero private author identifier rows and one committed import batch. No new records were created during this review. All 142 ordered author associations match their retained reviewed import payloads; this does not prove ambiguous source boundaries were reviewed correctly by a human.

The live system permits direct browser reads of `created_by` and `updated_by`, despite omitting those keys from the app's RPC JSON. The prepared repair needs separate production approval. Migration history remains unreconciled. Public signup is enabled; Auth URLs and authenticated hosted login/refresh/logout/revocation acceptance remain unverified. The password-protection advisor is unresolved. There is no installed cron extension or cleanup job. The newest local frontend is not deployed. Supabase backup restoration and multi-client hosted transactional acceptance remain unverified.

Remote mutations were left out because this project now serves the live site and the task prohibits production changes. Historical development authorization was not treated as permission to alter the live deployment.

## Next authorized work

Use the ordered manual steps in the [release checklist](release-checklist.md), [migration reconciliation](migration-reconciliation.md) and [recovery procedure](recovery.md). Resolve production approval and a separate Supabase development target before hosted write checks. Keep source review separate from technical verification; do not use release preparation to silently correct, import or publish records.

Suggested commit message: `chore: prepare release checks, access repair, and recovery runbook`

No commit, push or deployment was performed.
