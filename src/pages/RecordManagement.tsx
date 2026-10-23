import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ImportDialog } from '../components/ImportDialog'
import { SearchToolbar } from '../components/SearchToolbar'
import { RecordStatusDialog, statusLabel } from '../components/RecordStatusDialog'
import { explain, rpc, type Status, type Thesis } from '../lib/records'
import { usePageTitle } from './PublicPages'

const statuses = [['all', 'All'], ['draft', 'Drafts'], ['published', 'Published'], ['archived', 'Archived']] as const
type Result = { items: Thesis[]; total: number; page: number }
type Selection = { scope: string; total: number; all: boolean; ids: Set<string> }
export function RecordManagement() {
  usePageTitle('Record management')
  const [params, setParams] = useSearchParams()
  const query = params.toString()
  const [result, setResult] = useState<{ query: string; data: Result } | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [message, setMessage] = useState('')
  const [action, setAction] = useState<{ record: Thesis; status: Status } | null>(null)
  const status = statuses.some(([value]) => value === params.get('status')) ? params.get('status')! : 'all'
  const page = Math.trunc(Math.max(1, Math.min(100000, Number(params.get('page')) || 1)))
  useEffect(() => {
    let active = true
    const current = new URLSearchParams(query)
    const year = (key: string) => current.get(key) ? Number(current.get(key)) : null
    rpc<Result>('admin_records', { q: current.get('q') || '', record_status: status, year_from: year('year_from'), year_to: year('year_to'),
      topic_id: null, sort: current.get('sort') || 'newest', page }).then(data => {
      if (active) { setResult({ query, data }); setError('') }
    }).catch(cause => { if (active) { setResult(null); setError(explain(cause)) } })
    return () => { active = false }
  }, [query, status, page, refresh])
  const data = result?.query === query ? result.data : null
  const selectionScope = JSON.stringify([params.get('q') || '', status, params.get('year_from'), params.get('year_to'), params.get('sort') || 'newest', refresh])
  const [selection, setSelection] = useState<Selection>({ scope: selectionScope, total: 0, all: false, ids: new Set() })
  // Reset during render so a changed filter cannot briefly expose an old selection.
  // Pages share one scope. Reloads and changed result totals invalidate it.
  if (selection.scope !== selectionScope || (data && selection.total !== data.total) || (error && (selection.all || selection.ids.size))) {
    setSelection({ scope: selectionScope, total: data?.total ?? 0, all: false, ids: new Set() })
  }
  const isSelected = (id: string) => selection.all ? !selection.ids.has(id) : selection.ids.has(id)
  const selectedCount = selection.all ? selection.total - selection.ids.size : selection.ids.size
  const selectedOnPage = data?.items.filter(record => isSelected(record.id)).length ?? 0
  const pageSelected = !!data?.items.length && selectedOnPage === data.items.length
  function selectRecords(ids: string[], checked: boolean) {
    setSelection(current => {
      const next = new Set(current.ids)
      for (const id of ids) { if (checked !== current.all) next.add(id); else next.delete(id) }
      return { ...current, ids: next }
    })
  }
  function clearSelection() { setSelection(current => ({ ...current, all: false, ids: new Set() })) }
  function changePage(value: number) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next) }
  return <section className="page"><div className="page-heading"><h1>Record management</h1><Link to="/admin/records/new" className="button primary">Add record</Link></div>
    <SearchToolbar admin />
    {message && <p role="status" className="notice">{message}</p>}
    <button onClick={() => { setError(''); setResult(null); setRefresh(n => n + 1) }}>Reload records</button>
    <section className="table-panel" aria-label="Thesis records">
      <div className="status-tabs" role="group" aria-label="Record status">{statuses.map(([value, label]) => <button key={value} aria-pressed={value === status} onClick={() => { const next = new URLSearchParams(params); next.set('status', value); next.delete('page'); setError(''); setParams(next) }}>{label}</button>)}</div>
      <div className="record-selection" role="group" aria-label="Record selection">
        <label className="checkbox-label"><input type="checkbox" checked={pageSelected} disabled={!data?.items.length}
          ref={input => { if (input) input.indeterminate = selectedOnPage > 0 && !pageSelected }}
          onChange={event => selectRecords(data?.items.map(record => record.id) ?? [], event.target.checked)} />Select all on this page</label>
        <p role="status" aria-live="polite">{selection.all && !selection.ids.size ? `All ${selectedCount} matching records selected.` : `${selectedCount} ${selectedCount === 1 ? 'record' : 'records'} selected.`}</p>
        {data && data.total > data.items.length && pageSelected && (!selection.all || selection.ids.size > 0) && <button onClick={() => setSelection({ scope: selectionScope, total: data.total, all: true, ids: new Set() })}>Select all {data.total} matching records</button>}
        {selectedCount > 0 && <button onClick={clearSelection}>Clear selection</button>}
      </div>
      <div className="table-scroll" role="region" aria-label="Records table, scroll horizontally on small screens" tabIndex={0}><table><caption className="sr-only">Administrator thesis records</caption><thead><tr><th scope="col" className="selection-column">Select</th><th scope="col">Record ID</th><th scope="col" className="title-column">Title</th><th scope="col">Authors</th><th scope="col">Academic year</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>
        {data?.items.map(record => <tr key={record.id} className={isSelected(record.id) ? 'record-selected' : undefined}><td className="selection-column"><label className="checkbox-label"><input type="checkbox" checked={isSelected(record.id)} onChange={event => selectRecords([record.id], event.target.checked)} /><span className="sr-only">Select {record.title || 'Untitled draft'} (record {record.repository_code})</span></label></td><td>{record.repository_code}</td><th scope="row">{record.title || 'Untitled draft'}</th><td>{record.authors.map(a => a.full_name).join(', ') || 'Not provided.'}</td><td>{record.academic_year || 'Not provided.'}</td><td>{record.status}</td><td><div className="row-actions">{record.status === "published" && <Link to={`/records/${record.id}`}>View public record</Link>}<Link to={`/admin/records/${record.id}/edit?${query}`}>{record.status === 'archived' ? 'View archived record' : 'Edit'}</Link>{(record.status === 'archived' ? ['draft'] : record.status === 'published' ? ['draft', 'archived'] : ['published', 'archived']).map(value => <button key={value} onClick={() => setAction({ record, status: value as Status })}>{record.status === 'archived' ? 'Restore to draft' : statusLabel(value as Status)}</button>)}</div></td></tr>)}
      </tbody></table></div>
      {error ? <div className="table-empty"><p className="error" role="alert">{error}</p></div> : !data ? <p className="table-empty" role="status">Loading records…</p> : !data.items.length && <div className="table-empty" role="status"><h2>{data.total ? 'No records on this page.' : 'No records yet.'}</h2><p>{data.total ? 'Go to the previous page or change the filters.' : 'No records match this view. Add a draft or change the filters.'}</p></div>}
    </section>
    <nav className="pagination" aria-label="Pagination"><button disabled={!data || page <= 1} onClick={() => changePage(page - 1)}>Previous</button><span>{data?.total ? `Page ${page} · ${data.total} records` : 'No pages to show'}</span><button disabled={!data || page * 24 >= data.total} onClick={() => changePage(page + 1)}>Next</button></nav>
    {params.get("import") === "1" && <ImportDialog onClose={() => { const next = new URLSearchParams(params); next.delete("import"); setParams(next, { replace: true }) }} onComplete={() => { setResult(null); setRefresh(n => n + 1) }} />}
    {action && <RecordStatusDialog record={action.record} status={action.status} onClose={() => setAction(null)} onSuccess={() => { setMessage('Record status updated.'); setAction(null); setResult(null); setRefresh(n => n + 1) }} />}
  </section>
}
