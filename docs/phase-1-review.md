# Phase 1 review

## Scope and decisions

Header/footer revision, 22 October 2026: gerikah requested a sticky, slightly transparent navigation bar and a simple footer. Shared headers now use theme-colored translucency with subtle backdrop blur and a solid fallback. Measured header height sets the scroll offset so anchor targets and keyboard navigation remain clear of the sticky bar. The footer contains the existing Sipi logo, supplied department/campus wording and three repository links.

Navigation revision, 22 October 2026: gerikah requested Records in place of Admin Login in the public header, and About below Home on one scrolling page. The header and footer now link to `/#about`; `/about` redirects there for existing links. The About heading is a section heading under Home's main heading. Administrator login remains a direct route. Anchor navigation moves keyboard focus to the section and supports direct links and refresh.

Started from a documentation-only repository. Preserved the supplied guidance, logo and seven wireframes. No existing working application was replaced.

gerikah requested local work only, so a Netlify deployment and nonproduction database connection are deferred. The checked-in configuration prepares a later deploy; it does not establish one.

The supplied wireframes and design tokens take priority over generic frontend skill composition, imagery and animation preferences. No alternate art direction, stock pictures, synthetic records, totals or dates were added. Empty image regions are intentionally reserved, as requested. Home keeps the centered brand/search and lower text/image split; About keeps three image regions; results retain a responsive grid; record detail retains a left/right split; login retains the image/panel split; management retains horizontal navigation and a table; add/edit retains the full-width title, paired metadata and abstract/source split.

The source note uses the approved department wording with “Coverage years are pending verification.” in place of bracketed year values. This resolves the conflict between specification placeholders and the rule against displaying invented or bracketed values in the running interface. Contact notes are omitted until approved contact information exists.

All record IDs currently resolve to the unavailable state. The public detail frame therefore shows no fictitious abstract or metadata, and the edit frame is disabled. The shared card/grid is implemented but displays no cards until real published data is connected. No counts or page numbers are shown without a query.

Search, filter, sort and status selections are URL state only; they do not claim to query a database. Invalid filter ranges show an inline error. Unknown routes and record IDs have explicit unavailable states. Live data loading, query failures and authentication errors remain dependent on the Phase 2–4 integrations; they are not simulated with timers or fake requests.

## Verification

Verified on 22 October 2026:

- TypeScript type checking, ESLint and Vite production build pass.
- Seven Playwright tests pass against the production build in Google Chrome.
- All eight route variants (seven layouts, with both add and edit) were opened directly and refreshed at 1440px, 768px and 390px, in light and dark modes. No whole-page horizontal overflow or browser runtime errors were found.
- Reviewed 48 full-page screenshots against the seven supplied wireframes. Tablet and phone stacking preserves the requested structure. The table header scrolls inside its own region; its empty message remains fully visible.
- Verified loaded Quicksand and Nunito font weights, system theme selection, explicit theme persistence through navigation/reload, and switching when browser storage is unavailable.
- Verified search submission, year range validation, sorting, filter clearing, URL context on detail return and browser Back, and persistent status selection.
- Verified mobile navigation, show-password control, disabled login/import/save/publish actions, author ordering, long form input, and keep/discard handling for unsaved edits.
- Verified dialog focus stays inside, Escape closes it, and focus returns to the trigger. Fixed a native-dialog focus escape found during the first test run.
- Automated axe checks reported no WCAG 2 A/AA or WCAG 2.1 AA violations across all route variants in both themes, including text contrast. This is not a claim of a full accessibility audit.
- Confirmed `dist/_redirects` contains `/* /index.html 200`. Direct route refresh passed locally; Netlify hosting behavior is not yet deployed or verified.
- `git diff --check` passes. No commit or push was made.

The design skill source lint reported zero failures and three border warnings. These are intentional input/button/dialog boundaries specified in `design.md`. Its separate CDP browser inspector timed out at `Page.enable` with both Chrome and Edge, so it did not produce a passing inspection report. Playwright screenshots, overflow checks, font checks and axe provided the browser evidence instead.

The initial Playwright shell-launched preview did not shut down cleanly in this Windows environment. The final test setup uses Vite's in-process preview and its close method, keeping server startup and cleanup inside the test runner.

## Visual review

Round 1: the oversized symbol pushed Home content below the wireframe position, the mobile empty table message was clipped inside the wide table, and author controls added unnecessary vertical space. The symbol now sits beside the Sipi name, the empty message sits below the scrolling header, and author controls share a row where space permits.

Round 2:

- Seen in one second: centered Sipi brand and search on Home; the task and form/table on administrator pages.
- Idea: the supplied Sipi mark and department compendium copy anchor the exact wireframe structure.
- Live interactions: search URL controls, themes, Help, name ordering and unsaved-entry confirmation.
- Layouts: Home centered brand with lower split; About three columns then copy; discovery toolbar and empty grid; detail split; login split; management horizontal navigation and table; form paired fields and abstract/source split.
- Scope-based scores: design 7, usability 8, creativity 6.5, content 8; weighted score 7.3. No gallery-style direction was drawn because the supplied layouts, palette and typography were explicit requirements.
- Remaining visual limits: approved image areas remain empty by instruction, record cards/details cannot be reviewed with department content until approved data exists, and the full large form necessarily requires vertical scrolling on phones. No filler content or images were added to raise a design score.

## Remaining work

Phase 2: database schema and migrations, RLS and grants, active administrator checks, transactional write functions, login/logout and sessions. Protect all record-related metadata and clear protected data on logout. Verify direct API authorization, including disabled administrators with existing sessions.

Phase 3–5: persistent records and lifecycle, real public queries, classification/review dialogs, transactional CSV import after the actual compendium is supplied. No backend, authentication or import behavior is claimed complete in Phase 1.

## Phase 2 follow-up

This document records the Phase 1 review. Its pending source years and preview-only authentication descriptions are historical. The source mapping, protected routes and authentication now follow [Phase 2 setup](phase-2-setup.md). Wireframes are in `docs/references/`; the supplied logo is in `public/images/`.
