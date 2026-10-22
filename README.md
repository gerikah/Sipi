# Sipi

Sipi is a thesis record repository for the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila. It uses React, TypeScript, Vite and React Router. Supabase database and administrator access will follow in Phase 2.

## Run locally

Use Node.js 24 (or Node.js 22.12 or later).

```sh
npm ci
npm run dev
```

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. The local interface works without environment variables or a backend. It contains no thesis records. Form input stays in memory on the current page; it is never saved or sent anywhere. Only the selected theme is stored in localStorage.

## Checks

```sh
npm run typecheck
npm run lint
npm run build
npm test
```

Browser tests run against the production build using locally installed Google Chrome. Install Chrome, or change the Playwright channel to an available Chromium browser. Run `npm run build` before `npm test`. The test runner starts and stops Vite preview on `127.0.0.1:4183` in the same process, avoiding Windows shell process cleanup issues. Tests cover navigation, direct route refresh, themes, filters, keyboard dialogs, unsaved changes, empty states, accessibility and responsive overflow. Screenshots are written under ignored `test-results/` folders.

## Routes

| Page | Route |
| --- | --- |
| Home | `/` |
| Search results | `/records` |
| View record | `/records/:id` |
| About section below Home | `/#about` (`/about` redirects here) |
| Admin login | `/admin/login` |
| Record management | `/admin/records` |
| Add / edit record (shared layout) | `/admin/records/new`, `/admin/records/:id/edit` |

Public navigation shows Home, About and Records. About scrolls to the section below Home; Records opens the card results screen. Admin login is available directly at `/admin/login` without a public navigation link.

Unknown record IDs show “Record not found.” The edit route uses the same form with fields disabled because no stored record exists. Administrator pages are explicitly labeled local previews and provide no authentication or data access. Login, logout, import, save and publish remain disabled. Use “Preview record management” on the login page to inspect the workspace.

## Implementation

- `src/components/`: public/admin headers, theme toggle, search controls, dialogs and common states.
- `src/pages/`: the seven layouts, shared add/edit form and record card structure.
- `src/styles.css`: shared tokens, light/dark modes and responsive rules.
- `public/theme.js`: system or saved theme before first paint; tolerates blocked browser storage.
- `tests/`: browser interaction and accessibility checks. Test inputs never populate the app or screenshots as department records.

The supplied asset contains only the Sipi symbol. It is used unchanged alongside the name in Quicksand; a CSS inversion keeps the symbol visible in dark mode. Quicksand 600/700 and Nunito 400/600 are self-hosted through Fontsource, with `font-display: swap`. Their SIL Open Font Licenses are included in `public/licenses/`.

## Later Netlify deployment

This phase is local only; no site has been deployed. `netlify.toml` sets `npm run build`, `dist`, and Node.js 24. `public/_redirects` is copied into `dist` and rewrites all application routes to `index.html` with status 200, following [Netlify’s SPA routing guidance](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/).

When Phase 2 is ready, copy `.env.example` to `.env.local` and supply only the Supabase project URL and publishable key. Use a nonproduction project for previews. Do not add secret keys, service role keys, database passwords or compendium files to the frontend or Git. Configure production Auth URLs separately, then verify direct detail and admin links on the actual host.

## Phase progress

Phase 1 local implementation and browser review are complete. See [Phase 1 review](docs/phase-1-review.md) for check results and limitations. Hosted preview verification remains deferred.

The following dependencies remain open:

- The separate Sipi MVP Architecture and Development Plan was not present in this checkout. `AGENTS.md`, `design.md` and `content.md` supplied the implementation requirements.
- The source CSV, its column mapping and verified coverage years are pending.
- Approved department/campus/research images and contact details are pending. Reserved image areas contain no images or captions.
- A hosted preview and nonproduction Supabase configuration are deferred by gerikah’s instruction to work locally.

Phase 2 will add database migrations, RLS policies and deliberate grants, active administrator membership checks, transactional RPC writes, Supabase login/logout, session handling and access-denied states. Direct API allow/deny checks must cover visitors, unapproved users and disabled administrators. A hidden button or frontend route is not authorization.

Record lifecycle integration follows in Phase 3, public database discovery in Phase 4, and the verified CSV import workflow in Phase 5. Analytics, PDFs and student accounts remain outside the MVP.
