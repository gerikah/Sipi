// Read-only public checks. Never uses a secret/service-role key or signs in.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { loadEnv } from 'vite'
import { parseCsv, validateSourceColumns } from '../src/lib/csv.ts'

const origin = 'https://sipii.netlify.app'
const dir = '.local/release'
await mkdir(dir, { recursive: true })
const report = { checkedAt: new Date().toISOString(), origin, routes: [], assets: [], api: [] }
const get = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) })
  return { status: response.status, text: await response.text(), headers: response.headers }
}
const home = await get(origin)
const paths = [...home.text.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1])
let js = ''
for (const path of paths) {
  const asset = await get(origin + path)
  report.assets.push({ path, status: asset.status, bytes: Buffer.byteLength(asset.text), sha256: createHash('sha256').update(asset.text).digest('hex') })
  if (path.endsWith('.js')) js += asset.text
}
const env = loadEnv('production', process.cwd(), '')
const apiUrl = [...new Set(js.match(/https:\/\/[a-z0-9]+\.supabase\.co/g) || [])]
const keys = [...new Set(js.match(/sb_publishable_[A-Za-z0-9_-]+/g) || [])]
report.configuration = {
  publicUrlEmbedded: apiUrl.length === 1, publishableKeyEmbedded: keys.length === 1,
  matchesLocalPublicUrl: apiUrl[0] === (env.VITE_SUPABASE_URL || env.SUPABASE_URL),
  matchesLocalPublicKey: keys[0] === (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY),
  configuredSensitiveValueDetected: Object.entries(env).some(([name, value]) => value.length >= 8 && /SECRET|SERVICE_ROLE|PASSWORD|DATABASE_URL|PRIVATE_KEY/.test(name) && js.includes(value)),
  secretKeyPatternDetected: /sb_secret_[A-Za-z0-9_-]{12,}/.test(js),
  derivedTagUiPresent: js.includes('Hardware + Software'),
}
for (const path of ['/', '/records', '/records/00000000-0000-4000-8000-000000000000', '/admin/login', '/admin/records', '/admin/records/new']) {
  const response = await get(origin + path)
  report.routes.push({ path, status: response.status, servesAppShell: response.text.includes('/assets/') && response.text.includes('id="root"') })
}
if (apiUrl.length === 1 && keys.length === 1) {
  const headers = { apikey: keys[0], 'Content-Type': 'application/json' }
  async function api(label, path, body, extraHeaders = {}) {
    const result = await get(apiUrl[0] + path, { headers: { ...headers, ...extraHeaders }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) })
    let data; try { data = JSON.parse(result.text) } catch { data = null }
    report.api.push({ label, status: result.status, ...(data?.code ? { code: data.code } : {}), ...(Array.isArray(data) ? { rows: data.length } : {}) })
    return data
  }
  const search = await api('published search', '/rest/v1/rpc/search_records', { q: '', year_from: null, year_to: null, topic_id: null, sort: 'title', page: 1 })
  const records = [...(search?.items || [])]
  if (Number.isSafeInteger(search?.total) && search.total <= 1000) for (let page = 2; page <= Math.ceil(search.total / 24); page++) {
    const next = await api(`published page ${page}`, '/rest/v1/rpc/search_records', { q: '', year_from: null, year_to: null, topic_id: null, sort: 'title', page })
    records.push(...(next?.items || []))
  }
  report.content = {
    reportedPublishedTotal: search?.total, inspectedPublishedRows: records.length,
    distinctIds: new Set(records.map(r => r.id)).size,
    confirmedSourceOnly: records.length > 0 && records.every(r => r.source_name === 'CPE Department Compendium'),
    archiveIdsAreStrings: records.every(r => r.source_archive_id == null || typeof r.source_archive_id === 'string'),
    unexpectedProjectionFields: [...new Set(records.flatMap(r => Object.keys(r).filter(k => !['id', 'title', 'authors', 'advisers', 'panel_members', 'academicYear', 'abstract', 'source_name', 'source_created_at', 'source_archive_id', 'group_code', 'section_block'].includes(k))))],
  }
  // Compare public content to the ignored source in memory; report only counts.
  // This never stages the CSV or sends its cells to any service.
  try {
    const csv = parseCsv(await readFile('cpe_thesis_repository.csv', 'utf8'))
    validateSourceColumns(csv)
    const original = new Map(csv.rows.map(row => {
      const cells = Object.fromEntries(csv.headers.map((header, i) => [header, row[i]]))
      return [cells.archive_id, cells]
    }))
    const fields = { title: 'thesis_title', academicYear: 'batch_year', group_code: 'group_code', section_block: 'section_block', abstract: 'abstract', source_created_at: 'created_at' }
    const mismatchCounts = Object.fromEntries(Object.keys(fields).map(field => [field, 0]))
    let unmatchedArchiveIds = 0
    for (const record of records) {
      const source = original.get(record.source_archive_id)
      if (!source) { unmatchedArchiveIds++; continue }
      for (const [field, column] of Object.entries(fields)) {
        const raw = source[column]
        const expected = !raw?.trim() || /^null$/i.test(raw.trim()) ? null : field === 'abstract' ? raw : raw.trim()
        const actual = field === 'source_created_at' ? record[field]?.replace('T', ' ') : record[field]
        if ((actual ?? null) !== expected) mismatchCounts[field]++
      }
    }
    report.sourceComparison = { sourceRows: csv.rows.length, publishedRows: records.length, unmatchedArchiveIds, mismatchCounts, names: 'Not split or guessed; ordered reviewed associations audited separately.' }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    report.sourceComparison = { blocked: 'Ignored source CSV is unavailable locally.' }
  }
  if (records[0]) {
    const detail = await api('published detail', '/rest/v1/rpc/public_record', { record_id: records[0].id })
    report.content.detailReturned = detail?.id === records[0].id
    // Public data only, retained locally for read-only browser route checks.
    await writeFile(`${dir}/published-detail-path.txt`, `/records/${records[0].id}`)
  }
  await api('draft table visibility', '/rest/v1/theses?select=id,status&status=eq.draft&limit=1')
  await api('archived table visibility', '/rest/v1/theses?select=id,status&status=eq.archived&limit=1')
  // Permission probe only: limit=0 never retrieves actor identifiers.
  await api('audit actor column permission probe', '/rest/v1/theses?select=created_by,updated_by&limit=0')
  report.anonymousIsAdmin = await api('administrator membership check', '/rest/v1/rpc/is_admin', {})
  await api('administrator records denied', '/rest/v1/rpc/admin_records', {})
  await api('import batch listing denied', '/rest/v1/rpc/list_imports', {})
  for (const table of ['author_identifiers', 'import_rows', 'import_batches', 'audit_logs', 'administrators']) {
    await api(`private ${table} denied`, `/rest/v1/${table}?select=*&limit=0`, undefined, { 'Accept-Profile': 'private' })
  }
  const sources = await api('published source provenance', '/rest/v1/sources?select=name,coverage_start_year,coverage_end_year,coverage_verified')
  report.source = Array.isArray(sources) ? { matchingNames: sources.filter(s => s.name === 'CPE Department Compendium').length, unknownCoverageUnset: sources.every(s => s.coverage_start_year == null && s.coverage_end_year == null && !s.coverage_verified) } : null
  const settings = await api('public Auth settings', '/auth/v1/settings')
  report.authSettings = { signupDisabled: settings?.disable_signup, emailProviderEnabled: settings?.external?.email }
  const schema = await api('API schema', '/rest/v1/')
  report.exposedRpcPaths = Object.keys(schema?.paths || {}).filter(p => p.startsWith('/rpc/'))
}
await writeFile(`${dir}/hosted-read-check.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
