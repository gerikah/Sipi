export const MAX_CSV_BYTES = 2 * 1024 * 1024
export const MAX_CSV_ROWS = 200
export type Csv = { headers: string[]; rows: string[][] }
export const columns = {
  title: ['Thesis title', 'thesis_title'], academic_year: ['Academic year', 'batch_year'], authors: ['Authors', 'author_name'],
  advisers: ['Advisers', 'main_adviser'], panel_members: ['Panel members', 'final_panel_members'], abstract: ['Abstract', 'abstract'],
  group_code: ['Group code', 'group_code'], section_block: ['Section block', 'section_block'], source_archive_id: ['Original archive ID', 'archive_id'],
  source_created_at: ['Source timestamp', 'created_at'], student_number: ['Student number (private; nonempty rows require separate review)', 'student_number'],
} as const
export type Field = keyof typeof columns
export type Mapping = Record<Field, string>
export type Separator = 'review' | 'single' | 'comma' | 'semicolon' | 'newline'
export type Payload = Record<Exclude<Field, 'authors' | 'advisers' | 'panel_members'>, string | null> & { authors: string[]; advisers: string[]; panel_members: string[] }
export type ImportInput = { raw: Record<string, string>; payload: Payload; errors: string[] }

// CSV state machine: quoted delimiters/newlines, doubled quotes, BOM and CR/LF.
// Malformed quoting is fatal: never guess where the next source record begins.
export function parseCsv(text: string): Csv {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw new Error('Choose a CSV of at most 2 MB.')
  text = text.replace(/^\uFEFF/, '')
  if (text.includes('\0')) throw new Error('CSV contains an unsupported null character.')
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let closed = false
  const endCell = () => { row.push(cell); cell = ''; closed = false; if (row.length > 64) throw new Error('Use at most 64 columns.') }
  const endRow = () => { endCell(); rows.push(row); row = []; if (rows.length > MAX_CSV_ROWS + 1) throw new Error('Use at most 200 data rows.') }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else { quoted = false; closed = true } }
      else cell += c
    } else if (c === ',') endCell()
    else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; endRow() }
    else if (closed) throw new Error(`Unexpected text after a closing quote at data row ${rows.length}.`)
    else if (c === '"') { if (cell) throw new Error(`Unexpected quote at data row ${rows.length}.`); quoted = true }
    else cell += c
  }
  if (quoted) throw new Error('A quoted field is not closed. Correct the CSV before importing.')
  if (cell || row.length || closed) endRow()
  const headers = rows.shift()?.map(value => value.trim()) || []
  if (!headers.length || headers.some(value => !value)) throw new Error('Every column needs a nonempty header.')
  if (new Set(headers.map(value => value.toLowerCase())).size !== headers.length) throw new Error('Column headers must be unique.')
  if (!rows.length) throw new Error('The CSV has no data rows.')
  return { headers, rows }
}
export function proposedMapping(headers: string[]): Mapping {
  return Object.fromEntries(Object.entries(columns).map(([key, [, name]]) => [key, headers.find(h => h.toLowerCase() === name) || ''])) as Mapping
}
const absent = (value: string | undefined) => !value?.trim() || value.trim().toUpperCase() === 'NULL' ? null : value.trim()
function names(value: string | null, separator: Separator) {
  if (!value || value.toLowerCase() === 'no record' || separator === 'review') return []
  return (separator === 'single' ? [value] : value.split(separator === 'comma' ? ',' : separator === 'semicolon' ? ';' : /\r\n|\r|\n/)).map(v => v.trim()).filter(Boolean)
}
export function mapRows(csv: Csv, mapping: Mapping, separators: Record<'authors' | 'advisers' | 'panel_members', Separator>): ImportInput[] {
  return csv.rows.map(cells => {
    const raw = Object.fromEntries([...csv.headers.map((h, i) => [h, cells[i] || '']), ...cells.slice(csv.headers.length).map((value, i) => [`__extra_column_${i + csv.headers.length + 1}`, value])])
    const values = Object.fromEntries(Object.keys(columns).map(key => [key, absent(raw[mapping[key as Field]])])) as Record<Field, string | null>
    const payload: Payload = { ...values, authors: names(values.authors, separators.authors), advisers: names(values.advisers, separators.advisers), panel_members: names(values.panel_members, separators.panel_members) }
    payload.academic_year = payload.academic_year?.replace(/[–—]/g, '-') || null
    return { raw, payload, errors: cells.length !== csv.headers.length ? [`row: expected ${csv.headers.length} cells, found ${cells.length}; correct the CSV`] : [] }
  })
}
export function validateImport(row: ImportInput): string[] {
  const p = row.payload; const errors = [...row.errors]
  if (!p.title?.trim()) errors.push('title: enter a title')
  const year = p.academic_year?.match(/^(\d{4})-(\d{4})$/)
  if (!year || +year[1] < 1900 || +year[1] > 2199 || +year[2] !== +year[1] + 1) errors.push('academic_year: use adjacent years, YYYY-YYYY')
  if (!p.authors.length) errors.push('authors: enter at least one reviewed name')
  for (const key of ['authors', 'advisers', 'panel_members'] as const) if (p[key].length > 100 || p[key].some(n => !n.trim())) errors.push(`${key}: use up to 100 nonempty names`)
  if (p.source_archive_id && (!/^[1-9]\d{0,18}$/.test(p.source_archive_id) || BigInt(p.source_archive_id) > 9223372036854775807n)) errors.push('source_archive_id: use a positive PostgreSQL bigint')
  if (p.source_created_at) {
    const m = p.source_created_at.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?$/)
    const date = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) : null
    if (!m || !date || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 19) !== `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`) errors.push('source_created_at: use a valid YYYY-MM-DD HH:mm:ss without timezone')
  }
  if (p.student_number) errors.push('student_number: exclude this row until private identity mapping is reviewed')
  return errors
}
