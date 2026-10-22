# Sipi

Sipi is a thesis record repository for the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila. It uses React, TypeScript, Vite, React Router and Supabase.

## Run locally

Use Node.js 24 (or 22.12 or later):

```sh
npm ci
npm run dev
```

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. Public pages work without a backend and contain no thesis records. Administrator routes now require a verified Supabase session and active database membership. Administrator record management now loads and saves real records through secured RPCs. CSV import remains disabled. Unsaved edits are guarded and failed saves preserve input.

For login setup, migrations, required dashboard settings and first-administrator provisioning, read [Phase 2 setup](docs/phase-2-setup.md). Copy `.env.example` to `.env.local` only if no environment file exists. Supply only the project URL and publishable key. The actual environment is ignored by Git. Never put secret/service-role keys or database passwords in frontend configuration.

## Checks

```sh
npm run typecheck
npm run lint
npm run test:db
npm run build
npm run check:env
npm test
```

Database tests use a disposable PGlite PostgreSQL engine with test-only Auth claims. They execute migrations, grants, RLS and transactional functions; they do not verify live Supabase Auth or PostgREST. Browser tests build an isolated bundle with mocked loopback Auth responses and use locally installed Chrome. No test requests contact the configured remote project. Screenshots are in ignored `test-results/` folders.

The browser suite covers approved/denied/revoked access, session restoration, expiry, login errors, logout and local data clearing, plus navigation, themes, direct route refresh, filters, keyboard dialogs, unsaved edits, accessibility and desktop/tablet/mobile layouts. `check:env` verifies ignored environment files and checks the production output for configured sensitive values without printing those values.

## Routes

| Page | Route |
| --- | --- |
| Home and About | `/`, `/#about`; `/about` redirects |
| Search results | `/records` |
| View record | `/records/:id` |
| Admin login | `/admin/login` |
| Protected record management | `/admin/records` |
| Protected add/edit form | `/admin/records/new`, `/admin/records/:id/edit` |

Public navigation shows Home, About and Records. Login is accessed directly. The shared header stays visible while scrolling, supports both themes, and keeps administrator navigation horizontal. Unknown records show an unavailable state. No thesis data is invented or imported.

## Repository

- `AGENTS.md`: scope, architecture and development rules.
- `docs/design.md`, `docs/content.md`: visual and content specifications.
- `docs/database_schema.md`: supplied compendium mapping and schema rationale.
- `docs/phase-1-review.md`, `docs/phase-2-setup.md`, `docs/phase-3-review.md`: progress, verification and remaining gates.
- `docs/references/`: seven supplied wireframes; `public/images/`: supplied assets.
- `src/components/`, `src/pages/`, `src/styles.css`: shared UI, layouts and design tokens.
- `src/lib/`: Supabase configuration and administrator access/session handling.
- `supabase/migrations/`: baseline, transactional writes and administrator-management functions.
- `sipi_schema.sql`: unchanged reference SQL, copied into the baseline migration. Do not apply it separately.
- `tests/`: isolated browser and database checks.

Quicksand headings and Nunito body text are self-hosted through Fontsource. Licenses are in `public/licenses/`. The shared logo uses the supplied complete wordmark. Home and About use the four supplied research illustrations; About has no repeated logo. No images or contact details were invented.

## Hosting and progress

No frontend site was deployed. gerikah authorized the connected development database; pending transaction/management migrations were applied and history reconciled without creating thesis records. `netlify.toml` uses `npm run build`, publishes `dist`, and selects Node.js 24. `public/_redirects` provides the SPA rewrite for direct route refresh. Use an approved development Supabase project for previews and configure production Auth URLs separately.

Phase 1 layouts and Phase 2 administrator access are in place. Phase 3 record management is implemented, verified locally and configured in the authorized development database. See [Phase 3 review](docs/phase-3-review.md) for migration history, checks, source setup and remaining full-stack acceptance limits.

The supplied mapping identifies academic years 2015-2016, 2018-2019 and 2019-2020; this is not continuous or full-compendium coverage. No source, academic-year or thesis rows are seeded. The separate development-plan document and CSV file are not present in this checkout. Phase 3 connects record management; Phase 4 will connect public discovery, and Phase 5 implements reviewed CSV import. PDFs, analytics and student accounts remain outside the MVP.
