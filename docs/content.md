# Sipi screen content

Use this file for interface copy and field placement. Follow [design.md](design.md) for appearance and [AGENTS.md](../AGENTS.md) for development rules. Derived from the Sipi MVP Architecture and Development Plan version 2.0.

## Shared content rules

- Use plain words and consistent labels.
- Keep thesis titles, authors, years, abstracts, tags, source references and image assets empty until supplied. Bracketed values below identify empty design placeholders, not sample data.
- Never store placeholder strings in the database. Use null or empty lists for missing optional values; show the stated empty messages in the running app.
- Do not invent counts, contacts, coverage years or institutional endorsements.

## Required source note

Sipi contains thesis records from the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila, based on the available compendium records for academic years 2015–2016, 2018–2019, and 2019–2020.

Place this note on Home and About. These are separate verified academic years in the available subset, not continuous coverage. Broader compendium coverage stays unset. No records have been imported. Contact notes stay omitted until an approved contact is supplied.

## Shared navigation

The shared header stays visible while scrolling. The simple footer shows the Sipi logo, “Computer Engineering”, “PUP Main Campus, Sta. Mesa, Manila”, and links labeled Browse records, About Sipi and Back to top.

Public navigation: Home | About | Records, with a theme toggle. Home opens `/`, About scrolls to `/#about` below Home, and Records opens `/records`. Admin Login remains available at `/admin/login` but is not shown in public navigation.

Administrator navigation: Sipi Admin | Records | Add record | Import CSV | Help, with a theme toggle and account menu containing Log out. Import and Help open dialogs.

## 5 Screen content for Home and About

The following sections map content to the supplied wireframes. Square brackets name empty design placeholders. They are instructions for the frames, not example thesis data.

### Home page

| Wireframe area | Content to add |
| --- | --- |
| Top navigation | Home  /  About  /  Records. Add a compact theme toggle in the same header. |
| Centered brand | Sipi logo as supplied. Accessible image label: Sipi home. |
| Centered search | Screen reader label: Search thesis records (visually hidden). Placeholder: Search by title, author, or keyword. Enter submits to /records. |
| Lower left heading | Thesis records, easier to find. |
| Lower left description | Browse thesis records from the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila. |
| Lower left note panel | Required source note with the three verified academic years. |
| Lower right image | Supplied illustration: `public/images/Filing theses beside an archive laptop.png`. |

Before the compendium is loaded, searching opens a real empty state: “No thesis records are available yet.” Do not show invented totals, recent theses or coverage dates.

### About section below Home

Home and About share one scrolling page. The About navigation link targets `/#about`. Existing `/about` links redirect to that section. This supersedes the earlier separate-page arrangement, following gerikah's 22 October 2026 revision.

| Wireframe area | Content to add |
| --- | --- |
| Top navigation and brand | Reuse the Home navigation and theme toggle; do not repeat the logo in About. |
| Three image panels | Supplied open-book, examining-research and exploring-compendium illustrations from `public/images/`, in that order. |
| Heading below images | About Sipi |
| Description | Sipi helps students and faculty find thesis records from the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila. |
| Source paragraph | Use the complete required source note from section 1. |
| Short access note | This version provides thesis record details. Full thesis documents are not available here. |
| Closing note | For record corrections, contact [approved department contact]. Leave the contact value empty until supplied. |

Keep the three image columns and text below them on desktop. Stack them in the same order on mobile. Avoid adding a new mission statement, department history, official endorsement or contact details that have not been supplied.

## 6 Screen content for search and record view

### Searches Card Page

| Wireframe area | Content to add |
| --- | --- |
| Top left and search | Sipi logo links Home. Search label and placeholder match Home; preserve the submitted query. |
| Two rounded controls | Filter: academic-year start range and topic. Sort: Newest year, Oldest year or Title A to Z. Relevance may be added only with a defined ranking query. |
| Results summary | [result count] records; show selected filter chips and Clear filters when active. Compute counts from the filtered query. |
| Each card heading | [Thesis title] |
| Card inset block | [Author names] and [Academic year]. This is a metadata area, not a required thumbnail. |
| Card text | Abstract label with [Abstract excerpt]. If missing, display “No abstract available.” |
| Bottom chips | [Topic] and [Keyword] values only when present. Card title action: View record. |
| Below grid | Previous  /  [page]  /  Next. Disable unavailable actions; preserve query and filters. |

Keep three card columns at desktop, two when space allows and one on mobile. Support loading skeletons, “No records match your search. Try another keyword or clear the filters.” and “We could not load the records. Try again.”

### View Record Page

| Wireframe area | Content to add |
| --- | --- |
| Top row | Sipi logo, Back to results, search bar and the same Filter and Sort controls. |
| Left stack of cards | Other records from the current result set. Use [Thesis title], [Authors], [Year] and optional tags. Highlight the selected record. Do not label these recommendations. |
| Right main heading | [Thesis title]. Adjacent icon action: Copy record link; success message: Link copied. |
| Main text section | Abstract heading and [Abstract]. Missing value: No abstract available. |
| Right upper inset | Record details: [Authors], [Academic year], [Advisers], [Repository code]. |
| Tag row | [Topics] and [Keywords], omitted when absent. |
| Lower large block | Source: [Compendium label], [Source row or page reference]. Show only references actually present. |
| Right lower inset | Department: Computer Engineering. Campus: PUP Main Campus, Sta. Mesa, Manila. No document download action in this MVP. |

For a direct record link, show Back to all records and leave the left list empty until results are fetched. Return 404 style content for missing or unpublished records: “Record not found.” Stack the main record above the supporting results on mobile.

## 7 Screen content for login and management

### Admin Login Page

| Wireframe area | Content to add |
| --- | --- |
| Upper left | Sipi logo linked to Home. |
| Large left image | [Approved campus or department image]. Keep empty until supplied. |
| Right panel heading | Manage Sipi records |
| Form heading | Admin login |
| First input | Email address. Placeholder: Enter your email address. |
| Second input | Password. Placeholder: Enter your password. Include a Show password toggle. |
| Third row in frame | Use as a short help row: “Use your approved administrator account.” Do not add an unused third credential field. |
| Primary action and links | Log in; loading: Logging in…; links: Back to repository and Account help. |
| Messages | Missing fields: Enter your email address and password. Failed login: Email or password is incorrect. Account help: Contact [approved support contact]. |

Never display a signup link. Do not invent a support email or promise a password reset flow before it is configured. After login, open Record Management; after logout, clear protected data from the interface.

### Admin dashboard record management

| Wireframe area | Content to add |
| --- | --- |
| Shared horizontal header | Sipi Admin  /  Records  /  Add record  /  Import CSV  /  Help; right: theme toggle, [Admin email] account menu and Log out. Import and Help open dialogs. |
| Search row | Search records; Filter for year and topic; Sort; prominent Add record button. |
| Four table tabs | All  /  Drafts  /  Published  /  Archived. Counts appear only from real queries. |
| Seven table columns | Select  /  Record ID  /  Title  /  Authors  /  Year  /  Status  /  Actions. |
| Empty table rows | Leave values blank in the frame. Live empty message: No records yet. Add a record or import a CSV to get started. |
| Row actions | View, Edit, Publish or Return to draft, Archive or Restore to draft. Contextual actions depend on status; public View only when published. |
| Selected rows | Show selected count and Archive selected with confirmation. Do not implement bulk publish in the initial release. |
| Below table | Previous  /  [page]  /  Next. Keep the table header visible while scrolling long lists. |

Confirm archive with “Archive this record? It will no longer appear in public searches.” Use Archive and Cancel buttons. Help contains a short editing guide and the compendium source note. Tag management opens from filters or the record form; it does not need another page.

## 8 Screen content for adding and editing records

### Admin dashboard add record

Keep the shared horizontal administrator header. Reuse this page for editing; change its heading to Edit record and load the stored values. Use a normal page rather than forcing this large form into a narrow drawer.

| Wireframe area | Content to add |
| --- | --- |
| Top right action | Back to records. Confirm before discarding unsaved changes. |
| Form heading | Add thesis record |
| Full width first field | Thesis title *; placeholder: Enter thesis title. |
| First paired row | Left: Authors * with Add author and reorder controls. Right: Academic year * with placeholder YYYY-YYYY. |
| Second paired row | Left: Advisers, optional repeatable entries. Right: Topics, optional searchable selection. |
| Third paired row | Left: Keywords, optional multi value input. Right: Compendium source, optional for a draft and required before publishing. |
| Large lower left field | Abstract, optional; placeholder: Enter the abstract if available. |
| Lower right panel | Source details: [Compendium label], [Source row or page]. Below: status and automatically assigned Record ID. This panel is not a file uploader. |
| Lower right primary action | Save draft. Add Review and publish as a secondary action once required data is complete. |
| Review dialog | Show the entered metadata, missing required fields and possible duplicates. Buttons: Publish and Keep draft. Do not create a separate review page. |

### Validation and feedback

Keep labels visible above every input; placeholders do not replace labels. Required fields use an asterisk and the note “* Required fields.” On save, keep entered values and place specific messages beside invalid fields: “Enter a title”, “Add at least one author”, or “Enter a valid academic year”.

Drafts may have missing required publication fields, but any supplied value must be valid. Publishing requires title, year, at least one author and a selected source. Do not require an abstract, adviser, topic or keyword when the compendium does not provide it.

Successful save: “Draft saved.” Successful publish: “Record published.” Duplicate review: “A similar record already exists. Review it before continuing.” Save conflict: “This record changed while you were editing. Reload the latest version before saving.” A failed save must preserve the form.

### Layout and interaction

Preserve the full width title, paired metadata rows, large abstract field and smaller source panel shown in the frame. Stack fields in reading order on mobile. Place long author lists in expandable rows rather than squeezing names into one line. Do not require image uploads or add thesis files to match the visual placeholder shapes.

## 9 Import workflow and release checks

### Import CSV within Record Management

Use a wide dialog with four steps: Upload CSV, Map columns, Review rows and Import summary. Keep it in the existing workspace and preserve progress when validation fails. Warn before closing an uncommitted import.

Start with proposed limits of 2 MB and 500 rows per batch, then confirm them against measured performance and the real file. Accept UTF 8 CSV and define quoting and multiple author delimiters after reviewing the supplied compendium. Split larger files for the MVP. Do not assume column names or invent missing rows.

Upload step: Choose CSV, Source compendium, [start year] and [end year]. Coverage years may remain unset; publishing a coverage claim requires verification. Map step: match source columns to title, year, authors and optional metadata. Preserve original row references and author order.

Review step: show row number, status, mapped fields, errors and duplicate warnings. Revalidate staged values on the server. Invalid rows cannot be selected. Review suspected duplicates using normalized title, year and authors; the MVP allows skipping or correcting a duplicate, not a silent merge or overwrite.

Commit selected rows as drafts in one transaction using commit_import. Record the completed batch and inserted thesis IDs together. On timeout, check batch status before retrying. Summary labels: Imported drafts, Skipped rows, Invalid rows. Counts come from the committed batch. Remove raw file contents from browser memory on completion.

## Additional shared messages

| State | Copy |
| --- | --- |
| Missing optional detail | Not provided. |
| Archived | Record archived. |
| Session expired | Your session expired. Log in again to continue. |
| Access denied | You do not have access to this page. |

## Implementation notes

- Author and source fields marked required are publication requirements. Drafts can remain incomplete; supplied values must still be valid.
- Record review, confirmations, import steps and error states stay within the seven existing page layouts.
- Records with no abstract show No abstract available. Empty tags are omitted.
- Use real query results for result and status counts. An empty database is a supported state.
- Keep pending contact values empty; do not create a clickable fake email address.

Login follow-up: show the supplied wordmark in the navigation bar on `/admin/login`, rather than above its image area. Fill that area with `Hands Exploring a Research Compendium.png`. A signed-in account without active membership receives an explicit approval-needed message. Auth account creation alone does not approve administrator access.

## Phase 3 implementation notes

Record management is connected to real administrator RPCs. Additional schema fields are Group code, Section block, ordered Panel members, Original archive ID, Source data row and Source timestamp without timezone. Academic years, topics and keywords can be managed explicitly; sources must be selected from existing verified entries. Draft, publish, archive and restore actions use saved versions and confirmation dialogs. Conflicts preserve input until the administrator confirms reloading. Student identifiers never enter the form. Bulk actions and public record View are deferred; Import CSV remains disabled.
