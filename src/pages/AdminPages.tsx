import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Dialog, ImageArea } from '../components/Shared'
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
  return <section className="login-page"><div className="login-image-column"><ImageArea src="/images/Hands Exploring a Research Compendium.png" alt="Illustration of hands exploring a research compendium beside a laptop." /></div>
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
