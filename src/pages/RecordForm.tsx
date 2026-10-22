import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Dialog } from '../components/Shared'
import { RecordStatusDialog } from '../components/RecordStatusDialog'
import { emptyOptions, explain, loadOptions, rpc, type Options, type Person, type Thesis } from '../lib/records'
import { usePageTitle } from './PublicPages'

type Entry = { key: string; name: string; id?: string }
type Fields = { title: string; academic_year_id: string; source_id: string; abstract: string; group_code: string; section_block: string; source_archive_id: string; source_row_number: string; source_created_at: string; topic_ids: string[]; keyword_ids: string[] }
const blank: Fields = { title: '', academic_year_id: '', source_id: '', abstract: '', group_code: '', section_block: '', source_archive_id: '', source_row_number: '', source_created_at: '', topic_ids: [], keyword_ids: [] }
const people = (items: Person[], author = false): Entry[] => items.length ? items.map(p => ({ key: crypto.randomUUID(), id: author ? p.id : p.faculty_id, name: (author ? p.full_name : p.display_name) || '' })) : [{ key: crypto.randomUUID(), name: '' }]

function PeopleFields({ label, entries, disabled, errorId, onChange }: { label: string; entries: Entry[]; disabled: boolean; errorId?: string; onChange: (entries: Entry[]) => void }) {
  const singular = label === 'Authors' ? 'author' : label === 'Advisers' ? 'adviser' : 'panel member'
  return <fieldset className="people-fields" disabled={disabled} aria-invalid={!!errorId} aria-describedby={errorId}><legend>{label}{label === 'Authors' ? ' *' : ' (optional)'}</legend>
    {entries.map((person, index) => <div className="person-row" key={person.key}><label className="person-input"><span className="sr-only">{singular} {index + 1}</span><input autoComplete="off" value={person.name} placeholder={`Enter ${singular} name`} onChange={e => onChange(entries.map(p => p.key === person.key ? { ...p, name: e.target.value, ...(singular !== 'author' ? { id: undefined } : {}) } : p))} /></label>
      <div className="person-actions"><button type="button" aria-label={`Move ${singular} ${index + 1} up`} disabled={index === 0} onClick={() => { const next = [...entries]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next) }}>↑</button><button type="button" aria-label={`Move ${singular} ${index + 1} down`} disabled={index === entries.length - 1} onClick={() => { const next = [...entries]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(next) }}>↓</button><button type="button" aria-label={`Remove ${singular} ${index + 1}`} onClick={() => onChange(entries.filter(p => p.key !== person.key))}>Remove</button></div>
    </div>)}<button type="button" disabled={entries.length >= 100} onClick={() => onChange([...entries, { key: crypto.randomUUID(), name: '' }])}>Add {singular}</button>
  </fieldset>
}

export function RecordForm({ editing = false }: { editing?: boolean }) {
  const { id } = useParams()
  return <RecordEditor key={id || 'new'} editing={editing} id={id} />
}
function RecordEditor({ editing, id }: { editing: boolean; id?: string }) {
  usePageTitle(editing ? 'Edit record' : 'Add thesis record')
  const location = useLocation(); const navigate = useNavigate()
  const [record, setRecord] = useState<Thesis | null>(null)
  const [fields, setFields] = useState<Fields>(blank)
  const [authors, setAuthors] = useState<Entry[]>(() => people([])); const [advisers, setAdvisers] = useState<Entry[]>(() => people([])); const [panel, setPanel] = useState<Entry[]>(() => people([]))
  const [options, setOptions] = useState<Options>(emptyOptions)
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(''); const [refresh, setRefresh] = useState(0)
  const [dirty, setDirty] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState(''); const [issues, setIssues] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<string>(() => (location.state as { message?: string } | null)?.message || '')
  const [conflict, setConflict] = useState(false); const [uncertain, setUncertain] = useState(false); const [review, setReview] = useState(false)
  const [statusAction, setStatusAction] = useState<'draft' | 'archived' | null>(null)
  const [classification, setClassification] = useState<'topic' | 'keyword' | 'academic_year' | null>(null)
  const [classId, setClassId] = useState(''); const [className, setClassName] = useState(''); const [classError, setClassError] = useState(''); const [classPending, setClassPending] = useState(false)
  const [savedId, setSavedId] = useState(''); const [confirmReload, setConfirmReload] = useState(false)
  const lock = useRef(false); const classLock = useRef(false); const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const blocker = useBlocker(dirty || pending)
  function adopt(value: Thesis | null) {
    setRecord(value)
    setFields(value ? { title: value.title || '', academic_year_id: value.academic_year_id || '', source_id: value.source_id || '', abstract: value.abstract || '', group_code: value.group_code || '', section_block: value.section_block || '', source_archive_id: value.source_archive_id?.toString() || '', source_row_number: value.source_row_number?.toString() || '', source_created_at: value.source_created_at || '', topic_ids: value.topic_ids, keyword_ids: value.keyword_ids } : blank)
    setAuthors(people(value?.authors || [], true)); setAdvisers(people(value?.advisers || [])); setPanel(people(value?.panel_members || []))
    setDirty(false); setConflict(false); setUncertain(false); setError(''); setIssues({})
  }
  useEffect(() => {
    let active = true
    Promise.all([loadOptions(), rpc<Thesis | null>('admin_record', { record_id: id || null })]).then(([choices, value]) => {
      if (!active) return
      if (editing && !value) { setLoadError('Record not found.'); setLoading(false); return }
      setOptions(choices); adopt(value); setLoadError(''); setLoading(false)
    }).catch(cause => { if (active) { setLoadError(explain(cause)); setLoading(false) } })
    return () => { active = false }
  }, [id, editing, refresh])
  useEffect(() => { if (savedId && !dirty && !pending) navigate(`/admin/records/${savedId}/edit${location.search}`, { replace: true, state: { message: feedback } }) }, [savedId, dirty, pending, navigate, location.search, feedback])
  useEffect(() => {
    if (!dirty && !pending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, pending])
  const disabled = loading || !!loadError || pending || record?.status === 'archived' || uncertain || conflict
  function change<K extends keyof Fields>(key: K, value: Fields[K]) { setFields(current => ({ ...current, [key]: value })); setDirty(true); setFeedback('') }
  function validate(publish: boolean) {
    const next: Record<string, string> = {}
    if (publish && !fields.title.trim()) next.title = 'Enter a title.'
    if (publish && !fields.academic_year_id) next.academic_year_id = 'Select an academic year.'
    if (publish && !fields.source_id) next.source_id = 'Select a compendium source.'
    if (publish && !authors.some(a => a.name.trim())) next.authors = 'Add at least one author.'
    for (const key of ['source_archive_id','source_row_number'] as const) if (fields[key] && (!/^[1-9]\d*$/.test(fields[key]) || BigInt(fields[key]) > 9223372036854775807n || (key === 'source_row_number' && Number(fields[key]) > 2147483647))) next[key] = 'Enter a positive whole number within the supported range.'
    if (fields.source_archive_id && !fields.source_id) next.source_id = 'Select the source for this archive ID.'
    if (fields.source_created_at && !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/.test(fields.source_created_at)) next.source_created_at = 'Use YYYY-MM-DD HH:mm:ss without a timezone.'
    setIssues(next); return Object.keys(next).length === 0
  }
  const fieldError = (name: string) => issues[name] ? <span className="error" id={`error-${name}`}>{issues[name]}</span> : null
  const invalid = (name: string) => ({ 'aria-invalid': !!issues[name], 'aria-describedby': issues[name] ? `error-${name}` : undefined })
  async function save(publish: boolean) {
    if (lock.current || !validate(publish)) return
    lock.current = true; setPending(true); setError(''); setFeedback('')
    let committed = false
    try {
      const faculty = (items: Entry[]) => items.filter(p => p.name.trim()).map(p => p.id ? { faculty_id: p.id } : { display_name: p.name.trim() })
      const result = await rpc<{ id: string; version: number; status: string }>('save_record', { expected_version: record?.version ?? null, payload: {
        ...fields, id: record?.id ?? null, title: fields.title.trim() || null, academic_year_id: fields.academic_year_id || null, source_id: fields.source_id || null,
        group_code: fields.group_code.trim() || null, section_block: fields.section_block.trim() || null, abstract: fields.abstract || null,
        source_archive_id: fields.source_archive_id || null, source_row_number: fields.source_row_number ? Number(fields.source_row_number) : null, source_created_at: fields.source_created_at || null,
        authors: authors.filter(p => p.name.trim()).map(p => ({ ...(p.id ? { id: p.id } : {}), full_name: p.name.trim() })), advisers: faculty(advisers), panel_members: faculty(panel),
      } })
      committed = true
      if (publish && result.status === 'draft') await rpc('set_record_status', { id: result.id, status: 'published', expected_version: result.version })
      const latest = await rpc<Thesis>('admin_record', { record_id: result.id })
      if (!mounted.current) return
      adopt(latest); setReview(false); setFeedback(publish ? 'Record published.' : latest.status === 'draft' ? 'Draft saved.' : 'Changes saved.')
      if (!editing) setSavedId(result.id)
    } catch (cause) {
      if (!mounted.current) return
      const code = (cause as { code?: string }).code
      setError(committed ? 'The record was saved, but publishing or reloading could not be confirmed. Return to records and reload it before making another change.' : explain(cause))
      if (code === '40001') setConflict(true)
      if (committed || !code || ['PGRST000','PGRST001','PGRST002','PGRST003'].includes(code)) setUncertain(true)
      setReview(false)
    } finally { lock.current = false; if (mounted.current) setPending(false) }
  }
  function reload() { setLoading(true); setConfirmReload(false); setRefresh(n => n + 1) }
  function manage(kind: 'topic' | 'keyword' | 'academic_year') { setClassification(kind); setClassId(''); setClassName(''); setClassError('') }
  const choices = classification === 'topic' ? options.topics : classification === 'keyword' ? options.keywords : options.years
  const selection = (key: 'topic_ids' | 'keyword_ids') => <fieldset className="classification-list"><legend>{key === 'topic_ids' ? 'Topics (optional)' : 'Keywords (optional)'}</legend>{(key === 'topic_ids' ? options.topics : options.keywords).map(c => <label key={c.id} className="checkbox-label"><input type="checkbox" checked={fields[key].includes(c.id)} onChange={e => change(key, e.target.checked ? [...fields[key], c.id] : fields[key].filter(id => id !== c.id))} />{c.name}</label>)}<button type="button" onClick={() => manage(key === 'topic_ids' ? 'topic' : 'keyword')}>Manage {key === 'topic_ids' ? 'topics' : 'keywords'}</button></fieldset>
  return <section className="page"><div className="page-heading"><h1>{editing ? 'Edit record' : 'Add thesis record'}</h1><Link to={`/admin/records${location.search}`} className="button">Back to records</Link></div>
    {loading && <p role="status">Loading record and choices…</p>}{loadError && <div className="notice"><p className="error" role="alert">{loadError}</p><button onClick={reload}>Try loading again</button></div>}
    {error && <p className="error notice" role="alert">{error}</p>}{feedback && <p className="notice" role="status">{feedback}</p>}
    {(conflict || (editing && uncertain)) && <button onClick={() => setConfirmReload(true)}>Reload latest record</button>}
    {record?.status === 'archived' && <div className="notice"><p>This archived record is read-only. Restore it to draft to edit.</p><button onClick={() => setStatusAction('draft')}>Restore to draft</button></div>}
    <form className="record-form" onSubmit={e => { e.preventDefault(); void save(false) }}>
      <p>* Required fields for publishing. Drafts may be incomplete.</p>{!!Object.keys(issues).length && <p className="error" role="alert">Check the marked fields before continuing.</p>}
      <fieldset disabled={disabled} className="form-fields">
        <label>Thesis title *<textarea aria-label="Thesis title *" rows={2} value={fields.title} onChange={e => change('title',e.target.value)} placeholder="Enter thesis title" {...invalid('title')} />{fieldError('title')}</label>
        <div className="field-pair"><div><PeopleFields label="Authors" entries={authors} disabled={disabled} errorId={issues.authors ? "error-authors" : undefined} onChange={next => { setAuthors(next); setDirty(true) }} />{fieldError('authors')}</div><div className="stack"><label>Academic year *<select aria-label="Academic year *" value={fields.academic_year_id} onChange={e => change('academic_year_id',e.target.value)} {...invalid('academic_year_id')}><option value="">Not provided</option>{options.years.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{fieldError('academic_year_id')}</label><button type="button" onClick={() => manage('academic_year')}>Add academic year</button></div></div>
        <div className="field-pair"><PeopleFields label="Advisers" entries={advisers} disabled={disabled} onChange={next => { setAdvisers(next); setDirty(true) }} />{selection('topic_ids')}</div>
        <div className="field-pair">{selection('keyword_ids')}<label>Compendium source *<select aria-label="Compendium source *" value={fields.source_id} onChange={e => change('source_id',e.target.value)} {...invalid('source_id')}><option value="">Not provided</option>{options.sources.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{fieldError('source_id')}<span className="field-note">Required for publishing; optional for a draft. {options.sources.length ? '' : 'No sources are available. A verified source must be configured through trusted administration.'}</span></label></div>
        <div className="field-pair"><label>Group code (optional)<input value={fields.group_code} onChange={e => change('group_code',e.target.value)} /></label><label>Section block (optional)<input value={fields.section_block} onChange={e => change('section_block',e.target.value)} /></label></div>
        <PeopleFields label="Panel members" entries={panel} disabled={disabled} onChange={next => { setPanel(next); setDirty(true) }} />
        <div className="form-bottom"><label>Abstract (optional)<textarea className="abstract-input" value={fields.abstract} onChange={e => change('abstract',e.target.value)} placeholder="Enter the abstract if available" /></label>
          <section className="source-panel stack"><h2>Source details</h2>{(['source_archive_id','source_row_number','source_created_at'] as const).map(key => <label key={key}>{key === 'source_archive_id' ? 'Original archive ID (optional)' : key === 'source_row_number' ? 'Source data row (optional)' : 'Source timestamp (optional)'}<input value={fields[key]} placeholder={key === 'source_created_at' ? 'YYYY-MM-DD HH:mm:ss' : undefined} onChange={e => change(key,e.target.value)} {...invalid(key)} />{fieldError(key)}</label>)}<p className="field-note">Preserve the original source timestamp without a timezone.</p>
            <dl><dt>Record ID</dt><dd>{record?.repository_code ?? 'Assigned when saved.'}</dd><dt>Status</dt><dd>{record?.status || 'No saved record.'}</dd></dl><div className="stack"><button type="submit" className="primary">{pending ? 'Saving…' : record?.status === 'published' ? 'Save changes' : 'Save draft'}</button><button type="button" onClick={() => { if (validate(true)) setReview(true) }}>Review and publish</button></div>
          </section>
        </div>
      </fieldset>
    </form>
    {record && record.status !== 'archived' && <div className="actions"><button disabled={pending || dirty || uncertain || conflict} onClick={() => setStatusAction('archived')}>Archive record</button>{record.status === 'published' && <button disabled={pending || dirty || uncertain || conflict} onClick={() => setStatusAction('draft')}>Return to draft</button>}<p className="muted">Save or discard edits before changing status.</p></div>}
    {review && <Dialog title="Review and publish" onClose={() => { if (!lock.current) setReview(false) }}><p>{fields.title}</p><p>Authors: {authors.filter(p => p.name.trim()).map(p => p.name).join(', ')}</p><p>Academic year: {options.years.find(c => c.id === fields.academic_year_id)?.name}</p><p>Source: {options.sources.find(c => c.id === fields.source_id)?.name}</p><p>Check these details before publishing. Published records and their public metadata will be visible to visitors.</p><div className="actions"><button disabled={pending} className="primary" onClick={() => { void save(true) }}>{pending ? 'Publishing…' : 'Publish'}</button><button disabled={pending} onClick={() => setReview(false)}>Keep draft</button></div></Dialog>}
    {statusAction && record && <RecordStatusDialog record={record} status={statusAction} onClose={() => setStatusAction(null)} onSuccess={() => { setStatusAction(null); setFeedback('Record status updated.'); reload() }} />}
    {classification && <Dialog title={classification === 'academic_year' ? 'Add academic year' : `Manage ${classification}s`} onClose={() => { if (!classLock.current) setClassification(null) }}><form className="stack" onSubmit={async e => {
      e.preventDefault(); if (classLock.current) return; classLock.current = true; setClassPending(true); setClassError('')
      try { const selected = await rpc<string>('save_classification', { kind: classification, name: className.trim(), item_id: classId || null, expected_name: choices.find(c => c.id === classId)?.name ?? null }); const result = await loadOptions(); if (!mounted.current) return; setOptions(result); if (classification === 'academic_year') change('academic_year_id',selected); setClassification(null) }
      catch (cause) { if (mounted.current) setClassError(explain(cause)) } finally { classLock.current = false; if (mounted.current) setClassPending(false) }
    }}>{classification !== 'academic_year' && <label>Classification to edit<select disabled={classPending} value={classId} onChange={e => { setClassId(e.target.value); setClassName(choices.find(c => c.id === e.target.value)?.name || '') }}><option value="">Create new</option>{choices.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}<label>{classification === 'academic_year' ? 'Academic year (YYYY-YYYY)' : 'Name'}<input required maxLength={120} value={className} disabled={classPending} onChange={e => setClassName(e.target.value)} /></label>{classId && <p>Renaming changes this label on every associated record.</p>}{classError && <p role="alert" className="error">{classError}</p>}<button disabled={classPending} className="primary">{classPending ? 'Saving…' : 'Save classification'}</button></form></Dialog>}
    {confirmReload && <Dialog title="Reload the latest record?" onClose={() => setConfirmReload(false)}><p>Your current entries will be replaced with the stored version.</p><button className="primary" onClick={reload}>Replace entries and reload</button></Dialog>}
    {blocker.state === 'blocked' && <Dialog title={pending ? 'Save in progress' : 'Discard unsaved changes?'} onClose={() => blocker.reset()}><p>{pending ? 'Wait for the request to finish before leaving this page.' : 'Your entries have not been saved. Leaving this page will discard them.'}</p><div className="actions"><button onClick={() => blocker.reset()}>Keep editing</button><button disabled={pending} className="primary" onClick={() => blocker.proceed()}>Discard changes</button></div></Dialog>}
  </section>
}
