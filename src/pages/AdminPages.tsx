import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Dialog, ImageArea, Logo, Pagination, PhaseNotice } from '../components/Shared'
import { SearchToolbar } from '../components/SearchToolbar'
import { usePageTitle } from './PublicPages'

export function Login() {
  usePageTitle('Admin login')
  const [show, setShow] = useState(false)
  const [help, setHelp] = useState(false)
  return <section className="login-page"><div className="login-image-column"><Logo /><ImageArea /></div>
    <div className="login-panel"><h1>Manage Sipi records</h1><form className="login-card stack" onSubmit={(e) => e.preventDefault()}>
      <h2>Admin login</h2>
      <label>Email address<input type="email" autoComplete="username" placeholder="Enter your email address" /></label>
      <label>Password<input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" /></label>
      <label className="checkbox-label"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Show password</label>
      <p>Use your approved administrator account.</p>
      <button className="primary" disabled>Log in</button><p className="muted">Login is not available yet.</p>
      <div className="login-links"><Link to="/">Back to repository</Link><button type="button" className="text-button" onClick={() => setHelp(true)}>Account help</button><Link to="/admin/records">Preview record management</Link></div>
    </form></div>
    {help && <Dialog title="Account help" onClose={() => setHelp(false)}><p>Use your approved administrator account. Login is not available yet, and a support contact has not been provided.</p><p>There is no public signup.</p></Dialog>}
  </section>
}

const statuses = [['all', 'All'], ['draft', 'Drafts'], ['published', 'Published'], ['archived', 'Archived']] as const

export function RecordManagement() {
  usePageTitle('Record management')
  const [params, setParams] = useSearchParams()
  const status = statuses.some(([value]) => value === params.get('status')) ? params.get('status')! : 'all'
  return <section className="page"><div className="page-heading"><h1>Record management</h1><Link to="/admin/records/new" className="button primary">Add record</Link></div>
    <PhaseNotice /><SearchToolbar admin />
    <section className="table-panel" aria-label="Thesis records">
      <div className="status-tabs" role="group" aria-label="Record status">{statuses.map(([value, label]) => <button key={value} aria-pressed={value === status} onClick={() => { const next = new URLSearchParams(params); next.set('status', value); next.delete('page'); setParams(next) }}>{label}</button>)}</div>
      <div className="table-scroll" role="region" aria-label="Records table, scroll horizontally on small screens" tabIndex={0}><table aria-describedby="table-empty-message"><caption className="sr-only">{statuses.find(([value]) => value === status)?.[1]} records</caption><thead><tr><th scope="col">Select</th><th scope="col">Record ID</th><th scope="col" className="title-column">Title</th><th scope="col">Authors</th><th scope="col">Year</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody /></table></div>
      <div className="table-empty" id="table-empty-message" role="status"><h2>No records yet.</h2><p>Add a record or import a CSV to get started.</p><p className="muted">Saving records and CSV import are not available yet.</p></div>
    </section><Pagination />
  </section>
}
