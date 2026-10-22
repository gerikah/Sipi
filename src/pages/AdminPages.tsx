import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Dialog, ImageArea, Logo, Pagination, PhaseNotice } from '../components/Shared'
import { SearchToolbar } from '../components/SearchToolbar'
import { usePageTitle } from './PublicPages'
import { logIn, logOut, retryAccess, useAuth } from '../lib/auth'

export function Login() {
  usePageTitle('Admin login')
  const [show, setShow] = useState(false)
  const [help, setHelp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [params] = useSearchParams()
  const access = useAuth()
  const next = params.get('next') ?? ''
  const destination = /^\/admin\/records(?:\/[a-zA-Z0-9-]+(?:\/edit)?)?(?:\?[^#]*)?$/.test(next) ? next : '/admin/records'
  if (access.status === 'approved') return <Navigate to={destination} replace />
  return <section className="login-page"><div className="login-image-column"><Logo /><ImageArea /></div>
    <div className="login-panel"><h1>Manage Sipi records</h1><form className="login-card stack" onSubmit={async (e) => {
      e.preventDefault()
      const form = e.currentTarget
      const data = new FormData(form)
      setBusy(true)
      await logIn(String(data.get('email') ?? '').trim(), String(data.get('password') ?? ''))
      const password = form.elements.namedItem('password') as HTMLInputElement | null
      if (password) password.value = ''
      setBusy(false)
    }}>
      <h2>Admin login</h2>
      <label>Email address<input name="email" type="email" required autoComplete="username" placeholder="Enter your email address" disabled={busy} /></label>
      <label>Password<input name="password" type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="Enter your password" disabled={busy} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Show password</label>
      <p>Use your approved administrator account.</p>
      <button className="primary" disabled={busy || access.status === 'checking' || access.status === 'unconfigured'}>{busy ? 'Logging in…' : 'Log in'}</button>
      {access.status === 'checking' && !busy && <p role="status">Checking your session…</p>}
      {access.status === 'unconfigured' && <p role="status">Administrator login is not configured yet.</p>}
      {access.message && <p className="error" role="alert">{access.message}</p>}
      {access.status === 'error' && <button type="button" onClick={retryAccess}>Try access check again</button>}
      {['denied', 'error'].includes(access.status) && <button type="button" onClick={() => { void logOut() }}>Log out</button>}
      <div className="login-links"><Link to="/">Back to repository</Link><button type="button" className="text-button" onClick={() => setHelp(true)}>Account help</button></div>
    </form></div>
    {help && <Dialog title="Account help" onClose={() => setHelp(false)}><p>Use your approved administrator account. A support contact has not been provided.</p><p>There is no public signup.</p></Dialog>}
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
      <div className="table-scroll" role="region" aria-label="Records table, scroll horizontally on small screens" tabIndex={0}><table aria-describedby="table-empty-message"><caption className="sr-only">{statuses.find(([value]) => value === status)?.[1]} records</caption><thead><tr><th scope="col">Select</th><th scope="col">Record ID</th><th scope="col" className="title-column">Title</th><th scope="col">Authors</th><th scope="col">Academic year</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody /></table></div>
      <div className="table-empty" id="table-empty-message" role="status"><h2>No records yet.</h2><p>Add a record or import a CSV to get started.</p><p className="muted">Saving records and CSV import are not available yet.</p></div>
    </section><Pagination />
  </section>
}
