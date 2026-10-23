# Source tags and responsive layout — 23 October 2026

Gerikah requested more side margin, centered About text above the three supplied images, source-based discovery filters, and Hardware/Software grouping with tags at the bottom of result cards. This later instruction supersedes the earlier prohibition on extracted discovery tags. It does not change the 11-column import contract or authorize modifying or publishing remote records.

## Analysis and behavior

Latest follow-up: gerikah removed the “Why this grouping?” disclosure. Keep the automatic label, source-tags explanation and the tag's evidence tooltip; grouping is still not verified metadata. Do not add the disclosure back during release checks.

The ignored CSV was inspected locally again: 142 rows, with labeled Keywords or Index Terms lists in 122 abstracts. Terms are read from those lists, preserving their wording with whitespace normalized for display. Missing lists stay empty. Technology labels are recognized only when a supported technology name occurs explicitly in a title or abstract. The current rules find supported technology mentions in 50 rows; automatic grouping yields 91 hardware, 8 software, 38 combined and 5 unclassified. These are analysis results, not verified counts of implemented stacks or live publication totals. PHP currency amounts are excluded. Abstracts and names are never rewritten.

Hardware, Software, Hardware + Software, and Not classified are automatic discovery groups. Rules match physical components and named software methods in the title/abstract. Combined projects match either broad filter. Missing evidence remains unclassified. Cards label groups “auto”; details expose the matching words under “Why this grouping?”. These rules cannot reliably distinguish every background reference from a project's own implementation, or establish an exhaustive stack. Administrator review would be needed to make the group a verified classification; no review or persistence workflow is claimed here.

Cards retain equal content slots and show a compact tag preview at the bottom. Opening the record shows all extracted tags and the evidence. Filters support academic years, source keywords/index terms, mentioned technology, and automatic grouping together. Search context, sorting, pagination and Back to results retain their query parameters. Filter choices come only from published records, including when an administrator is signed in.

## Data and implementation boundaries

The existing published `search_records` RPC remains the only catalog read. Source filters fetch all matching published pages, apply the derived filters, then count and paginate; they never filter only the visible page. Collection reads are cancelled on navigation and fail on detectable count/page inconsistencies. The current implementation limits a matching catalog to 2,000 records and asks the reader to narrow search/years above that bound. It makes multiple RPC requests (six for 142 matching records); a larger collection should move facets into an explicitly reviewed database migration for performance and snapshot consistency.

No new migration is required. Existing classification tables are preserved, and no records or associations are modified. Import and publishing requirements are unchanged. Private identifiers are neither read nor analyzed. No raw CSV, personal data, or derived record cache is persisted in browser storage. The local analysis report in `.local/source-term-analysis.json` is ignored by Git and is not bundled.

## Layout

Content is capped at 1328px with at least 64px gutters on desktop, 40px below 1280px, 24px below 960px, and 16px below 640px. Existing responsive grids and the record reader remain intact. The About copy is centered within 800px and precedes the supplied illustrations. Typography and spacing retain the existing 8px scale.

## Verification

Focused coverage is in `tests/database/terms.test.mjs` and `tests/source-terms.spec.ts`: labeled lists, exact technology matching, PHP currency ambiguity, automatic groups and evidence, multiple filters, pagination across more than 24 records, private-draft exclusion, query preservation, error recovery, catalog bounds, both themes, keyboard focus and responsive layout. Browser and database fixtures are disposable and separate from application data. See `phase-4-5-review.md` for completed check results.
