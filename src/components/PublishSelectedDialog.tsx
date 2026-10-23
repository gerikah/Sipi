import { useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { Dialog } from './Shared'
import { explain, rpc, type Thesis } from '../lib/records'

type Selection = { all: boolean; ids: Set<string>; total: number }
type Result = { items: Thesis[]; total: number }
const quantity = (count: number, noun = 'record') => `${count} ${noun}${count === 1 ? '' : 's'}`
export function PublishSelectedDialog({ selection, filters, onClose }: {
  selection: Selection; filters: Record<string, unknown>; onClose: (attempted: boolean) => void
}) {
  const [records, setRecords] = useState<Thesis[] | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [published, setPublished] = useState(0)
  const [done, setDone] = useState(false)
  const lock = useRef(false); const attempted = useRef(false); const mounted = useRef(true)
  const blocker = useBlocker(() => lock.current)
  useEffect(() => { if (blocker.state === 'blocked') blocker.reset() }, [blocker])
  useEffect(() => {
    mounted.current = true
    let active = true
    async function load() {
      const selected: Thesis[] = []
      if (selection.all) {
        const seen = new Set<string>()
        for (let page = 1; page <= Math.ceil(selection.total / 24); page++) {
          if (!active) return
          const result = await rpc<Result>('admin_records', { ...filters, page })
          if (result.total !== selection.total) throw new Error('The matching records changed. Close this dialog, reload records and select them again.')
          for (const record of result.items) {
            if (seen.has(record.id)) throw new Error('The matching records changed. Close this dialog, reload records and select them again.')
            seen.add(record.id)
            if (!selection.ids.has(record.id)) selected.push(record)
          }
        }
        if (selected.length !== selection.total - selection.ids.size) throw new Error('The selection changed. Close this dialog, reload records and select them again.')
      } else {
        for (const id of selection.ids) {
          if (!active) return
          const record = await rpc<Thesis | null>('admin_record', { record_id: id })
          if (!record) throw new Error('A selected record is unavailable. Close this dialog and reload records.')
          selected.push(record)
        }
      }
      if (active) setRecords(selected)
    }
    void load().catch(cause => { if (active) setError(cause instanceof Error && !('code' in cause) ? cause.message : explain(cause)) })
    return () => { active = false; mounted.current = false }
  }, [selection, filters])
  useEffect(() => {
    if (!pending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pending])
  const drafts = records?.filter(record => record.status === 'draft') ?? []
  const invalid = drafts.filter(record => !record.title?.trim() || !record.academic_year_id || !record.source_id || !record.authors.length)
  async function publish() {
    if (lock.current || !records || !drafts.length || invalid.length || error || done) return
    lock.current = true; attempted.current = true; setPending(true)
    let count = 0
    try {
      for (const record of drafts) {
        if (!mounted.current) return
        try { await rpc('set_record_status', { id: record.id, status: 'published', expected_version: record.version }) }
        catch (cause) {
          if (mounted.current) setError(`Publishing stopped at “${record.title}”. ${explain(cause)} Confirmed published: ${quantity(count)}. Reload records before trying again; the last request may have completed if the connection was lost.`)
          return
        }
        count++
        if (mounted.current) setPublished(count)
      }
      if (mounted.current) setDone(true)
    } finally { lock.current = false; if (mounted.current) setPending(false) }
  }
  const close = () => { if (!lock.current) onClose(attempted.current) }
  return <Dialog title="Publish selected records?" onClose={close}>
    {error && <p className="error" role="alert">{error}</p>}
    {!records && !error && <p role="status">Loading selected records for review…</p>}
    {records && !done && <>
      <p>{quantity(drafts.length, 'selected draft')} will become visible on the public website.</p>
      {records.length > drafts.length && <p>Already published or archived: {quantity(records.length - drafts.length)}. These will be left unchanged. Archived records must be restored to draft before publishing.</p>}
      {invalid.length > 0 && <p className="error" role="alert">{invalid.length} drafts need a title, academic year, author or source. Edit these records before publishing the selection.</p>}
      <details><summary>Review {drafts.length} drafts</summary><ul>{drafts.map(record => <li key={record.id}>{record.title || 'Untitled draft'} — {record.academic_year || 'Academic year missing'}{invalid.includes(record) ? ' — Required details missing' : ''}</li>)}</ul></details>
      <p>Publishing happens one record at a time. If it stops, records already published stay visible; the remaining records stay unchanged.</p>
    </>}
    {(pending || done) && <p role="status">{done ? `${quantity(published)} published.` : `Publishing… ${published} of ${drafts.length} confirmed.`}</p>}
    <div className="actions">
      {!done && <button className="primary" disabled={!records || pending || !!error || !drafts.length || !!invalid.length} onClick={() => { void publish() }}>{pending ? 'Publishing…' : `Publish ${quantity(drafts.length)}`}</button>}
      <button disabled={pending} onClick={close}>{done ? 'Done' : error ? 'Close review' : 'Cancel'}</button>
    </div>
  </Dialog>
}
