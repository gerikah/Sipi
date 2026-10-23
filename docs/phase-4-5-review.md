# Public discovery and CSV importing

Latest development update: [CSV import installation repair](import-installation-repair.md). The missing transactional import functions have now been installed and verified in the authorized development database. Older “unapplied” statements below describe the initial delivery. No real records were staged or imported; hosted migration history reconciliation remains a release task.

Current scope revision: [Compendium column review](source-column-review.md) records the actual CSV inspection completed on 23 October 2026, exact labels, removed classification controls and the new local `20261023090000_compendium_content_scope.sql` migration. Earlier missing-CSV notes below describe the initial implementation; the file has since been supplied and inspected. Name boundaries still need explicit review where punctuation is ambiguous. This revision makes no remote database changes.

## Implementation and deployment status

Phase 4 public discovery and the Phase 5 import workflow are implemented locally. Existing React/Vite routes, fonts, colors, horizontal navigation, themes and wireframe structure are preserved. No real compendium data was imported, no remote records were published, and no production changes were made. Nothing was committed or pushed.

Two **local, unapplied** migrations follow the four Phase 3 migrations:

- `20261022144334_public_discovery.sql`
- `20261022144427_transactional_imports.sql`

These new migrations have not been applied to hosted Supabase. The Supabase connector used in the previous phase is unavailable in this session. They were applied repeatedly to fresh disposable PGlite PostgreSQL databases for checks. Public queries and imports in the configured hosted app require these migrations first. Do not rerun the baseline `sipi_schema.sql` or edit earlier applied migrations.

## Public discovery

Home search opens `/records`. Search, academic-year start range, sort and page live in the URL and survive record opening, refresh and Back. Topic/keyword controls are removed under the source-column revision. Every record has `/records/:id`; Copy record link omits search parameters for sharing. Clipboard failure exposes a selectable link.

`search_records(q, year_from, year_to, topic_id, sort, page)` is an invoker function that explicitly restricts results to published theses, including for administrators. Search covers title, abstract, repository code, group code, authors, advisers and keywords. Literal matching avoids wildcard interpretation. Filters precede counts and pagination, with at most 24 records and a final UUID sort key. There is no relevance ranking. `public_record(record_id)` returns only an explicit public projection; unavailable, draft and archived IDs return null. `public_topics()` includes only topics associated with published records.

Cards and details display real ordered names and available metadata. Empty abstracts receive the supplied empty copy; absent optional details/tags are omitted. Counts are query results. Loading, query errors with retry and record-not-found states are separate. Supporting detail cards come from the same result query; they are not recommendations.

Student numbers, raw imports, audit logs and administrator membership remain private. The new migration also replaces broad thesis SELECT grants with explicit column grants: browser roles cannot directly select `created_by` or `updated_by`. The administrator document function now uses an explicit projection compatible with those grants. RLS and transactional write authorization remain in effect.

Home/About describe the supplied subset as **2015–2016, 2018–2019 and 2019–2020**, not continuous coverage or a claim that records are already published. Record source labels come from actual selected sources. No broader coverage range is inferred or seeded.

## Initial mapping reference (superseded by actual file inspection)

No `.csv` file was found in this checkout (including ignored files) or the available attachment folders. `docs/development-plan.md` is also absent. `docs/database_schema.md` remains the earlier supplied mapping reference, including its reported 142 rows. **Actual headers, representative values, file encoding and name separators remain unverified for this implementation.** Do not treat a suggested column match as evidence that the actual file has been inspected.

| Proposed source column | Import destination | Handling |
| --- | --- | --- |
| `thesis_title` | Title | Required for import; trim outer whitespace |
| `batch_year` | Academic year | Required adjacent `YYYY-YYYY`; normalize en/em dash to hyphen |
| `author_name` | Ordered per-thesis authors | Required reviewed names; no global identity merging |
| `main_adviser` | Ordered adviser identities | Optional; explicit separator choice or row review |
| `final_panel_members` | Ordered panel members | Optional; same review rules |
| `abstract` | Abstract | Preserve text; no keyword extraction |
| `group_code` | Group code | Text, preserving leading zeroes |
| `section_block` | Section block | Optional text |
| `archive_id` | Original archive ID | Positive bigint as a decimal string; unique within a source |
| `created_at` | Source timestamp | Valid `YYYY-MM-DD HH:mm:ss`, optional 1–6 fractional digits, no timezone |
| `student_number` | Private staged data only | Nonempty mapped values invalidate the row until a separate identity mapping is reviewed; no student identifiers are guessed or written |

The selected existing compendium is the source for the whole batch. Source data row is the CSV data-record index starting at 1, excluding the header; quoted multiline fields do not increment it. If a file is split, the index is relative to that uploaded part, whose filename and hash are kept in the private batch. Retain the original file and splitting notes outside Git for provenance.

Empty cells and literal `NULL` become null. `No record` becomes an empty person list only. Names are not rewritten or automatically merged. The default for person columns is manual row review, starting with empty lists. Administrators can explicitly select a verified comma, semicolon, newline or single-person format and then correct every row using one person per line. Supplied adviser/panel values cannot silently become empty lists: server validation flags them when the mapped original cell contains names. Ambiguous commas must be resolved manually, not accepted as a default.

## Import workflow

Import CSV opens a wide dialog inside `/admin/records?import=1`:

1. **Select CSV:** choose an existing source and UTF-8 CSV. Recent imports reopen owned batches after refresh or a lost response.
2. **Map columns:** confirm suggested mappings and name formats. Title, academic year and author columns are required.
3. **Validate rows:** inspect original names, field errors and editable normalized metadata. Correct fields or leave invalid rows excluded. Returning without changing mapping retains corrections; changing mapping explicitly rebuilds the preview.
4. **Review duplicates:** staging revalidates on the server. Invalid rows and confirmed existing source IDs are disabled. All duplicate warnings start excluded. Review comparable year/authors and open existing records in a separate tab when needed.
5. **Confirm rows:** persist selections and explicit warning acknowledgements, then confirm the draft import. All selected rows must succeed together.
6. **Import summary:** show stored imported, skipped, invalid and failed counts, row-level skip reasons and edit links. Clear the raw upload and staging request from browser memory. Publication is separate.

Earlier steps retain work. Closing an unfinished import warns about unstaged changes. Pending requests prevent repeated submissions and closing. Logout/access loss unmounts the protected workspace.

## Limits and parsing

- Maximum file size: **2 MiB**; at most **200 data rows** and **64 columns** per batch.
- Strict UTF-8, optional BOM, comma-delimited fields, CRLF/LF/CR line endings, quoted commas/newlines and doubled quote escapes are supported.
- Empty/duplicate headers, malformed quotes and invalid encoding stop parsing. Wrong cell counts remain row errors and preserve extra cells privately; fix the file or exclude those rows.
- Server bounds: 6 MiB staged JSON, 16 KiB mapping metadata, 256 KiB normalized metadata per record and at most 100 people per relationship list. JSON escaping can reach the request cap before the CSV byte cap.
- Missing title/year/authors invalidates an import row. Manually entered drafts remain allowed to be incomplete; this stricter rule is specific to batch review.

The initial proposed 500-row limit was reduced after a disposable test took about 24.2 seconds across stage/review/commit. The final 200-row check took about **13 seconds** (stage 4.7 s, review 4.1 s, commit 4.1 s) with small isolated fixtures while other checks ran concurrently. An earlier run before the additional year/author comparison took 5.7 seconds. These are local measurements, not hosted latency guarantees. Measure the actual abstracts, catalog size and hosted statement timeouts before real import; split into smaller batches if necessary.

## Duplicate and transaction rules

An existing `(source_id, source_archive_id)` is a confirmed duplicate and cannot be selected. Repeated archive IDs within the file allow at most one selected row. Titles are normalized for comparison by lowercasing and removing non-alphanumeric characters. Equal or contained normalized titles of at least eight characters are **review candidates only**; the server also compares academic years and normalized author-name lists and shows matching or differing evidence. Name comparison ignores order and punctuation for warnings only; stored author order and original names remain unchanged. These signals do not prove person or record identity. This is conservative substring matching, not semantic/fuzzy identity matching. Different wording can evade detection, so manual review is still required.

All staging/read/review/commit functions recheck active membership and batch ownership. Private definer functions use fixed empty search paths, qualified objects and restricted grants; wrapper functions use invoker rights. Raw cells and student data are never returned by batch read RPCs. Client validation is additional feedback, not the authorization or validity boundary.

`stage_import` uses a stable client batch UUID and a server fingerprint of the request. Retrying identical staging returns that batch; changed input needs a new UUID. `review_import` revalidates rows, selections and duplicate acknowledgements. `commit_import` locks the batch and returns its stored result immediately if already committed. Otherwise it serializes thesis writes, checks current duplicate evidence and validation, creates missing valid academic-year rows, and calls the existing `save_record` transaction for ordered associations. Drafts, import links, counts and audit events commit together. A failure rolls everything back, including new years/faculty/audits. No records are overwritten or published.

`get_import` refreshes unfinished validation/duplicate evidence. Changed evidence invalidates confirmation and excludes the changed row until review. On an uncertain commit response, the interface requires checking the saved batch before retrying. A completed batch is returned as the same summary; an unfinished batch returns to review. `list_imports` exposes only the caller's latest 20 batches. Successful atomic batches have zero failed rows; invalid excluded rows are included in skipped counts and also reported separately. A failed request has no successful partial-import summary.

## Retention and manual setup

Development source setup, 23 October 2026: gerikah authorized the verified name **CPE Department Compendium**. A trusted server-side administrative request checked the connected development project's `public.sources` table, found no existing sources, and created this one entry. A fresh read verified exactly one case/whitespace-normalized match, ID `fadcc894-c47a-4542-8e64-3188f88bf8ff`. Coverage start/end and notes are null; `coverage_verified` remains false. Department and campus retain the existing schema defaults. No thesis records were imported or published, and no policies or frontend dropdown values were changed.

The existing source-reload browser regression passed: a valid local CSV remains selected while source choices reload, and selecting an available source enables Map columns. This check used isolated fixtures. No signed-in browser surface was accessible for a live administrator UI check. In the connected app, click **Reload sources**, select **CPE Department Compendium**, and keep a valid CSV selected. Broader coverage and the real CSV mapping remain separate verification tasks. This source setup does not establish whether pending import migrations have been applied.

Raw and normalized staged personal data stays private. `private.cleanup_imports()` clears it after 30 days, cancels old unfinished batches and preserves batch IDs, decisions, counts and imported record links for audit/idempotency. Browser roles cannot run cleanup. A trusted daily scheduled job or operator must call it; **no scheduler was installed here, so automatic retention is not configured yet**. This function and its preserved retry behavior are tested locally. Keep private imports and raw CSVs out of application logs, Git, public storage and frontend assets.

Before using the real compendium:

1. Review/apply the two pending migrations to the intended development project, checking its project reference first. With an authenticated, correctly linked CLI, inspect `npx supabase migration list --linked`, then `npx supabase db push --linked --dry-run` before applying. Never point this at production as part of this work.
2. Configure the actual verified source through trusted database administration. Do not invent its name or full coverage. Keep incomplete broader coverage unset.
3. Configure trusted daily staging cleanup and verify browser permissions through real Supabase Auth/PostgREST sessions, including disabled and unapproved accounts.
4. Inspect the actual CSV, confirm headers and delimiters, resolve ambiguous names, then open Import CSV with an active approved administrator.
5. Select the existing source, map columns, correct/exclude invalid rows and review duplicates. Confirm only reviewed rows. Inspect the stored summary and edit the resulting drafts.
6. Review drafts individually before publishing in a separately authorized content-loading step. Do not use importing as publication.

## Verification and release readiness

### Import feedback and dismissal fix, 23 October 2026

Reproduced locally with an isolated CSV: Close replaced the form subtree with confirmation content, unmounting the native file input. Keep reviewing recreated that input without its selected file. Parsed rows remained in React state, which made the reset especially confusing. Leave import also called navigation without allowing the already-confirmed dismissal through the route guard.

The confirmation now opens as a separate modal over the still-mounted import form. Cancelling preserves the exact step, file, parsed rows, source, mapping, corrections, validation and row selections, and returns focus. The File is also retained independently in memory, so returning between workflow steps can display its correct filename even when a native chooser remounts. Explicit Leave import permits the confirmed navigation and releases local state on unmount. Close and Escape use the same guard; backdrop dismissal is not enabled. Pending reads and requests remain protected. No CSV or personal data is persisted to localStorage.

Local reading, ready and invalid-file feedback is separate from server staging. Empty sources disable the selector and explain both the required trusted setup and the disabled next step. Reload sources preserves the selected CSV. Source loading is independent of recent-batch loading, so a failed batch-list request cannot hide valid source choices. Replacing a file clears its old parsed preview before validation, preventing a failed replacement from accidentally retaining an importable old file.

Source configuration is still required through trusted Supabase administration using verified details. This fix creates no sources, changes no migrations and imports no real records. The reported real CSV was not used for these checks.

Fix verification: the regression first failed because the chooser's selected File became undefined after Keep reviewing. After the fix, `npm test -- tests/import-feedback.spec.ts tests/discovery-import.spec.ts` passed all 9 tests. Coverage includes retained file/rows, mapping and corrections, focus after Close/Escape cancellation, explicit discard, missing-source guidance, malformed replacement, reading-time dismissal protection, source reload independent of batch-list failure, staged-batch reopening and recovery after a lost commit response. Light/dark screenshots were inspected at 1440px and 390px, including the scrolled next-step explanation; axe accessibility checks passed. `npm run lint` and `npm run build` (including type checking) passed. The existing bundle-size warning remains (about 597 KB). Database migrations were unchanged; the separate database suite was not rerun for this interface fix.

Local checks cover CSV parsing and bounds, database grants/RLS, public versus unpublished visibility, actor-ID privacy, batch ownership/revocation, ordered names, source provenance, duplicate decisions, stale evidence, forced rollback, idempotent retry, retention and a 200-row batch. Browser integration routes loopback requests into disposable PostgreSQL with test-only Auth claims; it exercises actual SQL, not a hosted PostgREST server. Browser checks cover public search/context/direct links, import correction/back navigation, duplicate acknowledgement, invalid-row exclusion, lost commit responses, recent batches and both themes at desktop/mobile widths.

Verification on 23 October 2026:

- `npm run lint`: passed.
- `npm run build`: type checking and production build passed. Vite reports a non-blocking 594 KB JavaScript chunk warning; bundle splitting remains a performance improvement.
- `npm run test:db`: 18 passed against disposable PGlite, including the final year/author duplicate comparison.
- `npm test`: all 18 browser tests passed. After the final duplicate-warning change, the four affected discovery/import tests were rerun successfully.
- `npm run check:env`: passed; browser configuration and built assets were checked without printing environment values.
- `git diff --check`: passed.
- Desktop/mobile screenshots were inspected against the supplied structure in both themes; browser checks include keyboard access, labels, axe accessibility checks and horizontal overflow. The public detail layout was corrected to put abstract and metadata side by side on desktop and stack them on mobile.
- The design skill source lint passed with zero failures/warnings. Its separate CDP inspector timed out at `Page.enable`; it produced no successful inspection report. Playwright screenshots and accessibility checks supplied the completed visual verification.

Existing phase checks remain part of the suite. Test fixtures are isolated and labeled; no fixture data enters application data, a remote project or the production bundle.

Release still needs actual CSV verification, migration deployment, source setup, scheduled cleanup, authenticated hosted API acceptance, concurrent multi-process verification, actual-data performance checks, production Auth/Netlify configuration and backup/restore rehearsal. Existing Supabase advisor notices from Phase 3 are not rechecked or resolved by this local work. The missing development-plan document and absent CSV are reported rather than assumed. No production deployment or release approval is claimed.
