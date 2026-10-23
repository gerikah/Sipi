# Sipi design guide

## Purpose

Sipi helps students and faculty find thesis records from the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila. Build the MVP from gerikah's seven supplied wireframes. Preserve their page structure, horizontal navigation, card grid, record view split and form grouping.

The companion architecture document defines page copy, data rules and development phases. This file defines interface design and implementation rules. Supabase provides PostgreSQL and administrator login; Netlify hosts the React TypeScript Vite frontend.

## Content and source note

Phase 2 source mapping supersedes the earlier pending-coverage wording. Use this note on Home and About:

> Sipi is a thesis record repository for the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila. The supplied compendium subset covers academic years 2015–2016, 2018–2019, and 2019–2020. These are separate academic years, not continuous coverage. Records appear here after administrator review and publication.

The available subset is not continuous coverage. Keep broader source coverage unset. Record placeholders describe empty fields and must never become stored values. No records are imported during Phase 2.

Do not invent thesis titles, names, abstracts, totals, source years, contact details, institutional endorsements or images. Use approved assets only. Missing optional data stays null or an empty list. Production uses helpful empty states rather than visible bracket placeholders.

Use plain words: Search records, View record, Add record, Edit record, Save draft, Publish, Archive, Import CSV and Back to records. Use “record” consistently in buttons. Keep “thesis” where needed to explain the content.

## Reference palette

| Token | Hex | Origin |
| --- | --- | --- |
| `ink` | `#161415` | Dynamic Black, printed hex in reference |
| `cream` | `#F3E2C8` | Honey Beige, sampled from the flat reference image area |
| `sand` | `#DBCBA9` | Egg Liqueur, sampled from the flat reference image area |
| `orange` | `#F35226` | Orange, sampled from the flat reference image area |

The three sampled colors are implementation values from the supplied JPEG, not claims about original brand hex codes. Use these values consistently. Extra shades below are functional supporting colors derived for readable surfaces, borders and errors.

## Light and dark themes

| Role | Light | Dark |
| --- | --- | --- |
| Page background | `#F3E2C8` | `#161415` |
| Card and form surface | `#FFF8ED` | `#242122` |
| Muted surface | `#DBCBA9` | `#332F30` |
| Primary text | `#161415` | `#F3E2C8` |
| Secondary text | `#51463B` | `#DBCBA9` |
| Input boundary | `#75654F` | `#958877` |
| Primary action fill | `#F35226` | `#F35226` |
| Primary action text | `#161415` | `#161415` |
| Focus ring | `#161415` | `#F3E2C8` |
| Error text | `#9E231B` | `#FFB5A8` |

Use dark text on orange buttons. Do not use orange for small text on cream or sand, or cream text on orange buttons. Links use the primary text color and an underline. Status badges use readable text plus a written status; color alone must not communicate draft, published, archived or errors.

Use a visible 2px focus ring with a 2px offset. Borders and focus strokes are exceptions to the 8px sizing grid; typography, spacing, radii and control dimensions use multiples of 8px.

Start with the operating system's preferred mode, then respect an explicit Light or Dark selection. Save the choice in localStorage. Apply the saved theme before first paint. Keep the switch keyboard accessible with a clear accessible name. Theme changes do not alter layout or content order. Make sure the logo is visible against each theme; preserve the supplied mark rather than redrawing it with a font.

```css
:root {
  color-scheme: light;
  --bg: #f3e2c8;
  --surface: #fff8ed;
  --surface-muted: #dbcba9;
  --text: #161415;
  --text-muted: #51463b;
  --border: #75654f;
  --action: #f35226;
  --on-action: #161415;
  --focus: #161415;
  --error: #9e231b;
  --font-heading: 'Quicksand', sans-serif;
  --font-body: 'Nunito', sans-serif;
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;
  --space-8: 64px;
  --space-10: 80px;
  --radius-control: 8px;
  --radius-card: 16px;
}
[data-theme='dark'] {
  color-scheme: dark;
  --bg: #161415;
  --surface: #242122;
  --surface-muted: #332f30;
  --text: #f3e2c8;
  --text-muted: #dbcba9;
  --border: #958877;
  --focus: #f3e2c8;
  --error: #ffb5a8;
}
```

## Typography

Use **Quicksand for headings** and **Nunito for body text**, including navigation, labels, fields, tables and buttons. Load only needed font weights and use `font-display: swap`. Prefer self hosted WOFF2 files with their licenses. The Sipi logo remains an image or supplied vector asset.

Font sizes and line heights must be multiples of 8px. Do not introduce 12px, 14px, 18px or 20px text. Use 16px as the minimum readable interface size; do not shrink table content to fit.

| Role | Font | Weight | Size / line height |
| --- | --- | --- | --- |
| Home heading, wide screens | Quicksand | 700 | 48px / 56px |
| Page heading | Quicksand | 700 | 40px / 48px |
| Section heading | Quicksand | 600 | 32px / 40px |
| Card or form heading | Quicksand | 600 | 24px / 32px |
| Body, metadata and table cells | Nunito | 400 | 16px / 24px |
| Labels, navigation and buttons | Nunito | 600 | 16px / 24px |
| Long abstract, optional larger view | Nunito | 400 | 24px / 32px |

On narrow screens, use 32px / 40px for page and Home headings and 24px / 32px for sections. Keep body text at 16px / 24px. Use weight and spacing for hierarchy rather than adding smaller font sizes. Limit long prose to about 65 characters per line where possible. Allow headings to wrap; never clip the thesis title on its detail page.

## Spacing and dimensions

Use the 8px scale for margins, padding, gaps, radii and fixed control dimensions: 8, 16, 24, 32, 40, 48, 56, 64, 80 and 96px. Fluid percentage widths may produce fractional pixels; authored fixed tokens stay on the grid.

| Element | Specification |
| --- | --- |
| Desktop content width | Maximum 1264px, centered |
| Wide page side padding | 32px; reduce to 24px then 16px as space narrows |
| Shared top navigation | Minimum height 80px; expand for wrapped content |
| Main section spacing | 48px or 64px |
| Card padding and grid gap | 24px; 16px gap on narrow screens |
| Label to input gap | 8px |
| Form field group gap | 24px |
| Input and button minimum height | 48px |
| Search control minimum height | 64px on wide screens, 48px on mobile |
| Icon size and hit area | 24px icon inside a minimum 48px target |
| Table row minimum height | 64px; grow for wrapped titles |
| Standard control radius | 8px |
| Card and panel radius | 16px |
| Pill control radius | 32px; use on search and matching wireframe controls |

Avoid fixed panel heights that clip long content. Inputs and buttons may grow with text zoom. Use a 1px border for visual structure; it is a deliberate stroke exception, not a spacing token.

## Layout and page content

Navigation and footer revision, 22 October 2026: shared navigation stays at the top while scrolling. Use a subtle theme-colored translucent background with 16px backdrop blur and a solid fallback, as requested by gerikah. Keep text opaque and readable. Anchor offsets follow the actual header height, including wrapped mobile navigation. Use a simple footer with the Sipi mark, department/campus text and links to records, About and the top of Home.

Use shared `PublicHeader`, `SearchToolbar`, `RecordCard`, `AdminHeader`, `RecordForm` and `ThemeToggle` components. Reuse the same widths, field appearance and navigation order across pages. Do not add a left sidebar to the administrator workspace.

### 1 Home

- Preserve the top horizontal navigation, large centered Sipi logo, centered search, lower left text and note, and lower right image.
- Navigation: Home, About and Records; theme toggle in the same header. Records opens `/records`. About scrolls to `/#about`, below the Home content. Admin Login stays available by its direct URL only.
- Search label: Search thesis records. Placeholder: Search by title, author, or main adviser.
- Heading: Thesis records, easier to find.
- Description: Browse thesis records from the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila.
- Use the required source note in the lower left panel. Lower right: `[Approved department or campus image]`, empty until supplied.
- Search submits to `/records?q=...`; do not add fake recent records or totals.

### 2 Searches Card Page

- Preserve Sipi logo, wide search and two rounded toolbar controls: Filter and Sort.
- Filter opens a popover or mobile sheet for academic year range. Topic/keyword controls are removed. Sort options: Newest year, Oldest year and Title A to Z.
- Cards: `[Thesis title]`, `[Authors]`, `[Academic year]`, `[Supplied abstract text when present]`. Use the inset block for metadata rather than a mandatory picture.
- Use three columns when wide, two at medium widths and one on mobile. Cards have equal padding; avoid clipping important author information.
- Add a real result count, clear filters and pagination without changing the overall grid structure.
- Title links open `/records/:id`. Preserve query, filters, sort and page for Back navigation.

### 3 View Record Page

- Preserve the toolbar, left stack of supporting record cards and wider right selected record panel.
- Left cards show other records from the current search, not an invented recommendation feed.
- Main panel: `[Thesis title]`, Copy record link, Abstract with `[Abstract]`, hide the section when the supplied abstract is empty.
- Right upper inset: Record details with `[Authors]`, `[Academic year]`, `[Main adviser]`, `[Original archive ID when present]`.
- Lower large block: Source with `[Compendium label]` and `[Source row or page reference]` when present. Show only available source metadata; department/campus remain repository context rather than extra thesis fields.
- Include Back to results. For direct links use Back to all records.
- Do not add PDF previews, cover images or download controls to fill blank shapes.

### 4 About

- Place this layout below Home on the same page, with the anchor `#about`. Keep `/about` as a redirect to `/#about`, not a separate page. This follows gerikah's 22 October 2026 revision.

- Preserve centered brand, three image columns and text below them.
- Heading: About Sipi.
- Description: Sipi helps students and faculty find thesis records from the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila.
- Add the exact source note. Access note: This version provides thesis record details. Full thesis documents are not available here.
- Images and department contact stay empty until approved. Do not invent endorsements or department history.

### 5 Admin Login

- Preserve the left image region and right panel containing the login card.
- Panel heading: Manage Sipi records. Form heading: Admin login.
- Visible labels: Email address and Password. Include Show password and Log in.
- Use the third wireframe row as help text: Use your approved administrator account. It is not a third credential.
- Links: Back to repository and Account help. The support contact is pending; no public signup.
- Show loading and incorrect credentials messages without clearing the email field.

### 6 Admin dashboard record management

- Preserve horizontal administrator navigation, toolbar and large table panel.
- Header: Sipi Admin, Records, Add record, Import CSV and Help. Right: theme toggle and account menu containing Log out.
- Tabs: All, Drafts, Published and Archived. Derive counts from authorized queries.
- Columns: Select, Record ID, Title, Authors, Year, Status and Actions.
- Give Title the most width; wrap long titles and authors. Use a contextual menu for actions.
- Add/Edit opens the form page. Import and Help open dialogs; classification editing uses small dialogs inside the workspace.
- Archive requires confirmation. Gerikah's 23 October revision adds Publish selected: review the selected draft count and confirm before making them public. Keep existing individual archive actions.
- Pagination below the table; loading and empty states inside the table region.

### 7 Admin dashboard add record

- Preserve the shared header, Back to records action, full width first field, paired metadata rows, large lower left abstract and smaller right source panel.
- Full width: Thesis title.
- Row 1: Authors with add and reorder controls; Academic year.
- Row 2: Main adviser; Compendium source.
- Row 3: Group code; Section/block. Final panel members remain an ordered optional field.
- Lower left: Abstract. Lower right: Source details, automatic Record ID and Status.
- Main action: Save draft. Secondary action: Review and publish opens a review dialog.
- Reuse the frame for editing. Do not add an upload control where no file is required.
- Inputs are empty for new records. Require title, year, at least one author and source before publishing; optional metadata remains optional.

## Supporting states within these pages

- Import CSV is a six step dialog: Select CSV, Map columns, Validate rows, Review duplicates, Confirm rows and Import summary. Do not create another top level page.
- Show row errors, duplicate warnings and selected row count before commit. Summary shows actual imported draft, skipped and invalid counts.
- Keep the academic-year dialog. Topic/keyword inputs and dialogs are no longer in the interface; preserve their stored data.
- Publishing and archiving show confirmation and specific error messages.
- Record review shows entered content, not fabricated data.
- Access denied and record not found are states inside the shared layout.

## Responsive behavior

Use breakpoints at 640px, 960px and 1280px, all multiples of 8px. Let available space determine wrapping; these are implementation targets rather than fixed canvas widths.

- At 1280px and above: preserve the desktop wireframe proportions; use 1264px maximum content width plus responsive page gutters.
- From 960px: allow three result columns when they remain readable; otherwise use two. Keep record view split where the main panel has enough width.
- Below 960px: use two result columns, stack record details above the supporting list, stack login image and form with the form first, and stack form pairs when needed.
- Below 640px: one result column, 16px gutters, full width search and stacked controls. Collapse navigation into an accessible menu; keep the same destinations.
- About images and Home lower panels stack in their original reading order.
- The admin table can scroll horizontally inside its own region. Preserve Title, Status and Actions access; do not shrink body text or cause whole page horizontal scrolling.
- Dialogs fit the viewport, scroll internally when needed and keep their title and close action reachable.

## Interaction and accessibility

Use semantic headings, links, buttons and forms. Keep persistent visible labels; placeholders only provide hints. Use `aria-current` for active navigation and `aria-sort` on sorted table columns. Label selection checkboxes with the record title when data is available.

Keyboard users must reach every action. Dialogs move focus inside, contain keyboard focus while open, close with Escape unless a save is running, and restore focus to the trigger. Unsaved changes require a discard confirmation. Use polite live announcements for result counts and saved states; urgent validation failures can use an alert.

Target contrast of at least 4.5:1 for normal text and 3:1 for large text and meaningful control boundaries. Verify actual rendered combinations in both modes. Do not rely on placeholder gray for required information. Keep actions at least 48px high and do not communicate status with color alone.

Use short transitions only when helpful and respect `prefers-reduced-motion`. Do not animate decorative dashboard elements or charts into pages that have no analytics in the MVP.

## Copy and empty states

| Situation | Copy |
| --- | --- |
| No imported public records | No thesis records are available yet. |
| No search matches | No records match your search. Try another keyword or clear the filters. |
| Missing abstract | Hide the optional section. |
| Optional value missing in details | Not provided. |
| Empty admin table | No records yet. Add a record or import a CSV to get started. |
| Query failure | We could not load the records. Try again. |
| Invalid login | Email or password is incorrect. |
| Saved draft | Draft saved. |
| Published | Record published. |
| Archived | Record archived. |
| Duplicate warning | A similar record already exists. Review it before continuing. |
| Edit conflict | This record changed while you were editing. Reload the latest version before saving. |
| Unknown record | Record not found. |
| Expired session | Your session expired. Log in again to continue. |

Loading skeletons temporarily match component shapes. They are not the permanent empty state. Disable duplicate submissions during saves and imports. Preserve form input on validation or network errors. Store no secrets in error messages.

## Implementation checklist

- [ ] Compare every page with its named supplied wireframe.
- [ ] Quicksand headings and Nunito body text load with fallback fonts.
- [ ] Font sizes, line heights, spacing, radii and fixed control sizes use multiples of 8px.
- [ ] Shared components use the same theme tokens and spacing.
- [ ] Light and dark modes retain clear text, borders, focus and logo visibility.
- [ ] No invented thesis records, counts, coverage years, contacts or assets are displayed.
- [ ] Source note names the three verified academic years without implying continuous coverage.
- [ ] Keyboard, mobile, loading, empty, error and long content states are reviewed.
- [ ] Search filters and navigation preserve the reader's place.
- [ ] Admin routes and UI use Supabase permissions; hiding controls is not the security layer.

## Supplied asset revision, 22 October 2026

Use the complete `public/images/Logo Word.png` asset wherever the shared logo appears, preserving its proportions and inverting it for dark mode. Remove the separate logo at the beginning of About. Use the supplied filing-theses illustration beside the Home description and the other three research illustrations in About. Preserve their full composition with contain sizing and meaningful alternative text; do not label them as campus photographs. This revision supersedes earlier empty image areas and repeated About branding.

Home spacing revision: public search labels and the sort label are visually hidden while retaining accessible names. The Home illustration area is at least 432px tall on wide screens and 320px on mobile. Space before About is 128px on wide screens and 80px on mobile.


Current discovery/import behavior, limits, missing-file verification and deployment gates are documented in [Phase 4 and 5 review](phase-4-5-review.md).

Current source-column scope and verified labels: [Compendium column review](source-column-review.md).
