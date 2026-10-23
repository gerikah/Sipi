# Compendium column review — 23 October 2026

Database follow-up: gerikah applied the content-scope migration manually. The earlier import installation was missing and has now been repaired in development; see [installation diagnosis and verification](import-installation-repair.md).

This scope supersedes earlier topic/keyword interface requirements. Thesis content is limited to the 11 supplied columns. Source selection is provenance; UUIDs, status, versions, Sipi timestamps, import tracking and audits remain internal system fields.

## Actual file inspected

Read the supplied `cpe_thesis_repository.csv` locally, first in Downloads and then after gerikah moved it into the project root. The file remains ignored by Git. No real rows were staged, imported or published.

- UTF-8, 194,469 bytes, exactly 11 headers and 142 data rows.
- SHA-256: `95ea6269c95a7aa7a87cacfbb20d6995e90b28e2ce0b54c8982c09583b269bdc`.
- Academic years: 2015–2016 (42 rows), 2018–2019 (28), 2019–2020 (72). This is not continuous or full source coverage.
- All rows contain archive IDs, titles, academic years, section/block, author text, abstracts and source timestamps. Group code is present in 72 rows; main adviser in 141 after treating `No record` as missing.
- Student numbers and final panel members are all missing/`NULL`. No person-to-student-number mapping is established.
- Source timestamps use `YYYY-MM-DD HH:mm:ss`, with no timezone. They are separate from Sipi creation and audit times.

## Exact labels and handling

| Source column | Interface label | Handling |
| --- | --- | --- |
| `archive_id` | Original archive ID | Decimal string in browser/RPC JSON; PostgreSQL bigint; no JavaScript Number conversion |
| `thesis_title` | Thesis title | Preserve wording; trim outer whitespace only |
| `group_code` | Group code | Text, preserving leading zeroes; missing stays null |
| `batch_year` | Academic year | Full adjacent year range linked to academic years |
| `section_block` | Section/block | Source text; missing stays null |
| `author_name` | Authors | Reviewed names in original order, without guessing boundaries |
| `student_number` | Student numbers (private) | Never public; nonempty rows blocked pending verified identity mapping, even if the column is unmapped |
| `main_adviser` | Main adviser | May contain several people; review each boundary and preserve order/text |
| `final_panel_members` | Final panel members | Optional reviewed ordered names; empty in this file |
| `abstract` | Abstract | Preserve supplied text, spacing and line breaks; no generated summary, topics or keywords |
| `created_at` | Source timestamp | Timestamp without time zone; never substitute Sipi timestamps |

The verified source name is **CPE Department Compendium**. Its existing development source entry is selected through normal source loading. No new source is created from a filename and no coverage range is inferred.

## Name boundaries

All 142 author fields contain commas; 16 also contain line breaks. A comma split yields between 2 and 7 segments, but this is not a verified person count: data row 119 has punctuation inside a name that produces an ambiguous short segment. Main adviser fields contain both lists and punctuation inside names; one value has a comma after an initial. There are spelling, initial, title and spacing variants. Do not silently correct or merge them.

Manual row review remains the default for all name lists. Administrators may choose a separator only after reviewing the affected values, and must resolve ambiguous rows explicitly. The preview shows original source name text. Private staging retains original cells under the existing retention rules; no student identifiers are assigned to authors or inserted into `private.author_identifiers` by importing.

## Implementation and deployment

- Forms retain the large existing layout, ordered people controls and source provenance. Topic/keyword controls and filters are removed. Student numbers have a private-handling explanation rather than an unverified assignment input.
- Saves omit classification associations completely, preserving historical data. Import payloads already allow only the mapped source metadata; unsupported CSV headers are rejected. No topic extraction from abstract text is performed.
- Public cards/details hide empty optional values, including Abstract. They display source content and selected source provenance, with no generated tags or institutional metadata presented as thesis fields.
- New migration `20261023090000_compendium_content_scope.sql` replaces public projections and public/admin search, and prevents unmapping `student_number` from bypassing server validation. The old `topic_id` RPC argument remains for compatibility but is ignored. Legacy classification tables, associations and administrative functions remain intact.
- This migration is local and **not applied to the connected database**. Previous migrations are unchanged. Apply pending migrations in order through trusted administration after review.

Publication requirements remain title, academic year, at least one author and an existing source. Main adviser, panel members, abstract, group code, section/block, original archive ID and source timestamp are optional. Topics, keywords and student numbers are never publication requirements. Manual drafts may be incomplete; batch imports still require title/year/authors for review.

## Remaining work

Resolve ambiguous person boundaries before a real import. Future nonempty student identifiers need a separate verified mapping process; none is implemented or inferred here. Hosted migration deployment and authenticated end-to-end acceptance remain release gates. No broader compendium coverage is established by this file.

## Verification

- `npm run test:db`: 20 passed in disposable PGlite, including source-only import/publication with optional values absent, bigint strings, blocked identifiers, unchanged legacy classification associations, private/public permissions, ordered names, rollback and retries.
- `npm test`: 23 passed, including retained CSV state, source reload, ordered form editing, no classification controls, hidden empty public details, publication and staged-batch recovery using isolated fixtures only.
- `npm run lint` and `npm run build` (including type checking): passed. The existing approximately 595 KB bundle-size warning remains.
- Desktop/mobile form and public-detail screenshots were inspected in light/dark themes. The browser suite also checks keyboard access, labels, contrast, overflow and direct-route refresh.
- Real-file checks were read-only parsing and inspection. Structural/year/archive/timestamp validation found no errors when name fields were temporarily treated as source text for inspection; this is not approval of person boundaries or import readiness.
