import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { Dialog } from './Shared'
import { columns, mapRows, MAX_CSV_BYTES, parseCsv, proposedMapping, validateImport, validateSourceColumns, type Csv, type Field, type ImportInput, type Mapping, type Payload, type Separator } from '../lib/csv'
import { explain, loadOptions, rpc, type Choice } from '../lib/records'

type Duplicate = { kind: string; reason: string; same_year: boolean; same_authors: boolean; row_number?: number; record_id?: string }
type StagedRow = { row_number: number; payload: Payload | null; errors: string[]; duplicates: Duplicate[]; decision: string; reviewed: boolean; reason: string | null; thesis_id: string | null }
type Batch = { id: string; filename: string; status: string; total: number; imported: number; skipped: number; invalid: number; failed: number; rows: StagedRow[] }
type Recent = { id: string; filename: string; status: string }
const steps = ['Select CSV', 'Map columns', 'Validate rows', 'Review duplicates', 'Confirm rows', 'Import summary']
const nameFields = ['authors', 'advisers', 'panel_members'] as const
function installationError(cause: unknown): string | null {
  const code = (cause as { code?: string } | null)?.code
  if (code === 'PGRST202') return 'CSV importing is not configured in this database. Install the missing import functions and refresh the database API. Your selected file and corrections remain in this dialog.'
  if (code === '42883') return 'A database function needed for CSV importing is missing. Apply the import repair migration. Your selected file and corrections remain in this dialog.'
  return null
}
export function ImportDialog({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState(0); const [sources, setSources] = useState<Choice[]>([]); const [recent, setRecent] = useState<Recent[]>([])
  const [source, setSource] = useState(''); const [filename, setFilename] = useState(''); const [hash, setHash] = useState(''); const [csv, setCsv] = useState<Csv | null>(null)
  const [file, setFile] = useState<File | null>(null); const [reading, setReading] = useState(false); const [fileError, setFileError] = useState('')
  const [sourceState, setSourceState] = useState<'loading' | 'ready' | 'error'>('loading'); const [sourceReload, setSourceReload] = useState(0)
  const [mapping, setMapping] = useState<Mapping | null>(null); const [separators, setSeparators] = useState<Record<typeof nameFields[number], Separator>>({ authors: 'review', advisers: 'review', panel_members: 'review' })
  const [rows, setRows] = useState<ImportInput[]>([]); const [batch, setBatch] = useState<Batch | null>(null)
  const [selected, setSelected] = useState<number[]>([]); const [acknowledged, setAcknowledged] = useState<number[]>([])
  const [pending, setPending] = useState(false); const [error, setError] = useState(''); const [uncertain, setUncertain] = useState(false); const [closing, setClosing] = useState(false)
  const lock = useRef(false); const mounted = useRef(true); const stageRequest = useRef({ key: '', id: '' }); const mappedKey = useRef('')
  const dirty = !!(file || csv || batch || source) && batch?.status !== 'committed'
  const allowClose = useRef(false)
  const blocker = useBlocker(() => !allowClose.current && (dirty || pending))
  const finishClose = () => { allowClose.current = true; onClose() }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let active = true
    loadOptions().then(options => { if (active) { setSources(options.sources); setSourceState('ready') } }).catch(() => { if (active) setSourceState('error') })
    return () => { active = false }
  }, [sourceReload])
  useEffect(() => {
    let active = true
    rpc<Recent[]>('list_imports').then(imports => { if (active) setRecent(imports) }).catch(cause => { if (active) setError(installationError(cause) ?? 'Recent imports could not be loaded. Close and reopen to try again. Your selected file has not been saved.') })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!dirty && !pending) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, pending])
  async function run(task: () => Promise<void>) {
    if (lock.current) return
    lock.current = true; setPending(true); setError('')
    try { await task() } catch (cause) {
      if (mounted.current) {
        const failure = cause as { code?: string; message?: string }
        setError(installationError(cause) ?? (failure.code === '40001' ? 'Records changed since this batch was reviewed. Reload the batch and review the new duplicate warnings.'
          : failure.message && /^(Row \d+|Review duplicate|Select |No selected|Import limit|This import|Use a new batch)/.test(failure.message) ? failure.message
          : cause instanceof Error && !('code' in cause) ? cause.message : explain(cause)))
      }
    }
    finally { lock.current = false; if (mounted.current) setPending(false) }
  }
  function adopt(value: Batch) {
    setBatch(value); setUncertain(false)
    setSelected(value.rows.filter(r => r.decision === 'import' || (r.decision === 'pending' && !r.errors.length && !r.duplicates.length)).map(r => r.row_number))
    setAcknowledged(value.rows.filter(r => r.reviewed).map(r => r.row_number))
    setStep(value.status === 'committed' ? 5 : 3)
    if (value.status === 'committed') { setFile(null); setFileError(''); setCsv(null); setRows([]); setMapping(null); setHash(''); stageRequest.current = { key: '', id: '' }; onComplete() }
  }
  async function readFile(selectedFile: File) {
    await run(async () => {
      setFile(selectedFile); setFilename(selectedFile.name); setReading(true); setFileError('')
      setCsv(null); setHash(''); setMapping(null); setRows([]); setBatch(null)
      mappedKey.current = ''; stageRequest.current = { key: '', id: '' }
      try {
        if (selectedFile.size > MAX_CSV_BYTES) throw new Error('Choose a CSV of at most 2 MB.')
        const bytes = await selectedFile.arrayBuffer()
        let text: string
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
        catch { throw new Error('Save the file as UTF-8 CSV and select it again.') }
        const parsed = parseCsv(text)
        validateSourceColumns(parsed)
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('')
        if (!mounted.current) return
        setCsv(parsed); setHash(digest); setMapping(proposedMapping(parsed.headers))
      } catch (cause) {
        if (mounted.current) setFileError(`${cause instanceof Error ? cause.message : 'The file could not be read.'} Correct the file and select it again.`)
      } finally { if (mounted.current) setReading(false) }
    })
  }
  async function stage() {
    if (!csv || !mapping) return
    const input = { source_id: source, filename, file_hash: hash, mapping: { columns: mapping, separators }, rows }
    const key = JSON.stringify(input)
    if (stageRequest.current.key !== key) stageRequest.current = { key, id: crypto.randomUUID() }
    const value = await rpc<Batch>('stage_import', { batch_id: stageRequest.current.id, ...input })
    if (mounted.current) adopt(value)
  }
  async function commit() {
    if (!batch) return
    try { const value = await rpc<Batch>('commit_import', { batch_id: batch.id }); if (mounted.current) adopt(value) }
    catch (cause) { if (mounted.current) setUncertain(true); throw cause }
  }
  const close = () => { if (lock.current) return; if (dirty) setClosing(true); else finishClose() }
  const cancelClose = () => { setClosing(false); if (blocker.state === 'blocked') blocker.reset() }
  const leave = () => {
    if (lock.current) return
    allowClose.current = true
    if (blocker.state === 'blocked') blocker.proceed(); else finishClose()
  }
  const toggle = (values: number[], n: number, checked: boolean) => checked ? [...values.filter(v => v !== n), n] : values.filter(v => v !== n)
  const reviewRows = batch?.rows || []
  const nextReason = reading ? 'Wait until the CSV has been read.' : sourceState === 'loading' ? 'Loading compendium sources…'
    : sourceState === 'error' ? 'Reload compendium sources before continuing.' : !sources.some(item => item.id === source) ? 'Source required before continuing'
      : fileError ? 'Correct the file validation error before continuing.' : !csv ? 'Select a valid CSV before continuing.' : ''
  return <><Dialog title="Import CSV" onClose={close}>
    <div className="import-workflow stack" aria-busy={pending}>
      <p>Step {step + 1} of {steps.length}: {steps[step]}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {reading ? <p role="status">Reading CSV…</p> : pending && <p role="status">Working…</p>}
      {fileError && <p className="error" role="alert">File validation failed: {fileError}</p>}
      {csv && file && <div className="notice"><p role="status">CSV ready: {file.name} · {csv.rows.length} rows</p><p>{batch ? 'A batch has been staged. Local corrections are saved only when you check duplicates again.' : 'Selected and read locally in this browser. Nothing has been uploaded or saved yet.'}</p></div>}
      {step === 0 && <>
        <p>Choose a UTF-8 CSV up to 2 MB and 200 data rows. Imported records remain drafts.</p>
        <label>Compendium source<select aria-label="Compendium source" aria-describedby="import-source-help" disabled={pending || sourceState !== 'ready' || !sources.length} value={source} onChange={e => setSource(e.target.value)}><option value="">Choose an existing source</option>{sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <div id="import-source-help" className={!sources.length ? 'notice' : undefined}>
          {sourceState === 'loading' ? <p role="status">Loading compendium sources…</p> : sourceState === 'error' ? <p role="alert">Compendium sources could not be loaded. Reload sources to try again; your selected CSV will stay here.</p>
            : !sources.length ? <><p><strong>No compendium source is configured. A source must be added before you can continue.</strong></p><p>Ask the project owner or database administrator to add the verified compendium source in Supabase. Use its confirmed name and only verified coverage years. Then reload sources here. The CSV filename does not create a source.</p></>
              : <p>Choose the existing compendium that these records came from.</p>}
        </div>
        <button disabled={pending || sourceState === 'loading'} onClick={() => { setSourceState('loading'); setSourceReload(n => n + 1) }}>Reload sources</button>
        <label>CSV file<input type="file" accept=".csv,text/csv" disabled={pending} onChange={e => {
          const selectedFile = e.target.files?.[0]; if (selectedFile) void readFile(selectedFile)
        }} /></label>
        <div className="stack"><button aria-describedby="import-next-reason" disabled={pending || !!nextReason} onClick={() => setStep(1)}>Map columns</button><p id="import-next-reason">{nextReason}</p></div>
        {!!recent.length && <section><h3>Recent imports</h3><ul>{recent.map(item => <li key={item.id}><button disabled={pending} onClick={() => { void run(async () => { const value = await rpc<Batch>('get_import', { batch_id: item.id }); if (mounted.current) adopt(value) }) }}>{item.filename} — {item.status}</button></li>)}</ul></section>}
      </>}
      {step === 1 && csv && mapping && <>
        <p>The 11 source headers were verified in cpe_thesis_repository.csv. Check each mapping against your selected file. CPE Department Compendium is the verified source name; its selection records provenance and is not a CSV column.</p>
        <div className="field-pair">{(Object.keys(columns) as Field[]).map(key => <label key={key}>{columns[key][0]}<select disabled={pending} value={mapping[key]} onChange={e => setMapping({ ...mapping, [key]: e.target.value })}><option value="">Not mapped</option>{csv.headers.map(h => <option key={h}>{h}</option>)}</select></label>)}</div>
        {nameFields.map(key => <label key={key}>Name format: {columns[key][0]}<select value={separators[key]} onChange={e => setSeparators({ ...separators, [key]: e.target.value as Separator })}><option value="review">Enter reviewed names on each row</option><option value="single">One person per field (verified)</option><option value="comma">Commas (verified)</option><option value="semicolon">Semicolons (verified)</option><option value="newline">Line breaks (verified)</option></select></label>)}
        <p>Authors and main adviser values contain commas, including ambiguous punctuation within names. Line breaks can also occur inside a field. Manual review starts with empty name lists: enter one verified person per line in source order, without rewriting the source text. Select a separator only after checking every affected row.</p>
        <p>Student numbers (private): nonempty values require a verified author mapping before identifier storage. Those rows are blocked; Sipi never guesses the assignment. Final panel members may remain empty.</p>
        <div className="actions"><button onClick={() => setStep(0)}>Back</button><button disabled={!mapping.title || !mapping.academic_year || !mapping.authors} onClick={() => {
          const key = JSON.stringify({ hash, mapping, separators }); if (mappedKey.current !== key) { setRows(mapRows(csv, mapping, separators)); mappedKey.current = key; setBatch(null) }
          setStep(2)
        }}>Validate and preview</button></div>
        <p>Changing mapping choices rebuilds the preview. Returning without changing them preserves row corrections.</p>
      </>}
      {step === 2 && <>
        <p>Check names in their original order. Enter one reviewed name per line. Invalid rows remain available to review but cannot be imported. Structural CSV errors require correcting the file.</p>
        {rows.map((row, i) => <details className="import-row" key={i}><summary>Row {i + 1}: {row.payload.title || 'Missing title'} — {validateImport(row).length ? 'Needs correction or exclusion' : 'Ready for duplicate review'}</summary>
          <div className="stack"><ul className="error">{validateImport(row).map((v, n) => <li key={n}>{v}</li>)}</ul>
          {mapping && nameFields.map(key => row.raw[mapping[key]] && <p key={key}>Original {columns[key][0].toLowerCase()}: {row.raw[mapping[key]]}</p>)}
          {(Object.keys(columns) as Field[]).filter(key => key !== 'student_number').map(key => <label key={key}>{columns[key][0]} — row {i + 1}<textarea aria-label={`${columns[key][0]} — row ${i + 1}`} rows={nameFields.includes(key as typeof nameFields[number]) ? 3 : 2} value={Array.isArray(row.payload[key]) ? (row.payload[key] as string[]).join('\n') : row.payload[key] || ''} onChange={e => {
            const value = nameFields.includes(key as typeof nameFields[number]) ? (e.target.value ? e.target.value.split('\n') : []) : e.target.value || null
            setRows(current => current.map((r, index) => index === i ? { ...r, payload: { ...r.payload, [key]: value } } : r)); setBatch(null)
          }} /></label>)}</div>
        </details>)}
        <div className="actions"><button disabled={pending} onClick={() => setStep(1)}>Back</button><button disabled={pending} onClick={() => { void run(stage) }}>Check duplicates</button></div>
      </>}
      {step === 3 && batch && <>
        <p>Select rows to import. Invalid rows and confirmed existing archive IDs cannot be selected. Review similar titles without assuming they are the same thesis.</p>
        {reviewRows.map(row => {
          const blocked = row.errors.length > 0 || row.duplicates.some(d => d.kind === 'existing_id') || batch.status === 'cancelled'
          return <section className="import-row stack" key={row.row_number}><label className="checkbox-label"><input type="checkbox" disabled={pending || blocked} checked={selected.includes(row.row_number)} onChange={e => setSelected(toggle(selected, row.row_number, e.target.checked))} />Row {row.row_number}: {row.payload?.title || 'Unavailable row'}</label><p>{row.payload?.academic_year} · {row.payload?.authors.join(', ')}</p>
            {!!row.errors.length && <ul className="error">{row.errors.map((v, i) => <li key={i}>{v}</li>)}</ul>}
            {!!row.duplicates.length && <><ul>{row.duplicates.map((d, i) => <li key={i}>{d.reason} {d.same_year ? 'Same academic year.' : 'Academic year differs or is missing.'} {d.same_authors ? 'Author names match.' : 'Author names differ.'} {d.row_number && `Row ${d.row_number}.`}{d.record_id && <a href={`/admin/records/${d.record_id}/edit`} target="_blank" rel="noreferrer">Open existing record in a new tab</a>}</li>)}</ul>{!blocked && <label className="checkbox-label"><input type="checkbox" disabled={pending} checked={acknowledged.includes(row.row_number)} onChange={e => setAcknowledged(toggle(acknowledged, row.row_number, e.target.checked))} />I compared the warnings and want to import this row as a separate draft.</label>}</>}
          </section>
        })}
        <p>{selected.length} selected; {reviewRows.length - selected.length} excluded.</p>
        <div className="actions"><button disabled={pending} onClick={() => setStep(csv ? 2 : 0)}>Back</button><button disabled={pending || !selected.length || batch.status === 'cancelled'} onClick={() => { void run(async () => {
          const value = await rpc<Batch>('review_import', { batch_id: batch.id, selected_rows: selected, acknowledged_rows: acknowledged }); if (mounted.current) { adopt(value); if (value.status !== 'committed') setStep(4) }
        }) }}>Confirm selected rows</button><button disabled={pending} onClick={() => { void run(async () => { const value = await rpc<Batch>('get_import', { batch_id: batch.id }); if (mounted.current) adopt(value) }) }}>Reload batch</button></div>
      </>}
      {step === 4 && batch && <>
        <p>Import {batch.rows.filter(r => r.decision === 'import').length} selected rows as drafts? All selected rows must succeed together. Publishing stays a separate action.</p>
        <p>{batch.rows.filter(r => r.decision === 'skip').length} rows will be skipped.</p>
        {uncertain && <p role="alert">The result could not be confirmed. Check the saved batch status before retrying. No new batch will be created.</p>}
        <div className="actions"><button disabled={pending} onClick={() => setStep(3)}>Back to review</button>{uncertain ? <button disabled={pending} onClick={() => { void run(async () => { const value = await rpc<Batch>('get_import', { batch_id: batch.id }); if (mounted.current) adopt(value) }) }}>Check import status</button> : <button className="primary" disabled={pending} onClick={() => { void run(commit) }}>{pending ? 'Importing…' : 'Import drafts'}</button>}</div>
      </>}
      {step === 5 && batch && <>
        <h3>Import complete</h3><p role="status">Imported drafts: {batch.imported}. Skipped rows: {batch.skipped}. Failed rows: {batch.failed}. Invalid rows among skipped: {batch.invalid}.</p>
        <ul>{batch.rows.map(row => <li key={row.row_number}>Row {row.row_number}: {row.thesis_id ? <Link to={`/admin/records/${row.thesis_id}/edit`}>Edit imported draft</Link> : row.reason || 'Skipped.'}{!!row.errors.length && <p>{row.errors.join('; ')}</p>}</li>)}</ul>
        <p>The original upload has been cleared from this browser. Staged personal data is retained privately for up to 30 days when scheduled cleanup is configured.</p><button onClick={onClose}>Close summary</button>
      </>}
    </div>
  </Dialog>
    {(closing || blocker.state === 'blocked') && <Dialog title="Leave this import?" onClose={cancelClose}><p>Leave import discards unfinished local changes and clears the selected file from this browser. Staged batches remain available in Recent imports for 30 days.</p><div className="actions"><button onClick={cancelClose}>Keep reviewing</button><button disabled={pending} onClick={leave}>Leave import</button></div></Dialog>}
  </>
}
