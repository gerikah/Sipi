import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Dialog, Icon, Logo, SourceNote } from './Shared'
import { logOut, useAuth } from '../lib/auth'

function ThemeToggle() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme ?? 'light')
  const [explicit, setExplicit] = useState(() => {
    try { return ['light', 'dark'].includes(localStorage.getItem('sipi-theme') ?? '') } catch { return false }
  })
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const followSystem = () => { if (!explicit) setTheme(media.matches ? 'dark' : 'light') }
    media.addEventListener('change', followSystem)
    return () => media.removeEventListener('change', followSystem)
  }, [explicit])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])
  return <button className="theme-toggle" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next); setExplicit(true)
    try { localStorage.setItem('sipi-theme', next) } catch { /* Theme still works for this visit. */ }
  }}><Icon name={theme === 'light' ? 'moon' : 'sun'} /><span>{theme === 'light' ? 'Dark' : 'Light'}</span></button>
}

export function PublicHeader() {
  const [open, setOpen] = useState(false)
  const { pathname, hash } = useLocation()
  const login = pathname === '/admin/login'
  return <header className="site-header"><div className={`public-header container${login ? ' login-header' : ''}`}>
    {login && <Logo />}
    <button className="mobile-menu" aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(!open)}>Menu</button>
    <nav id="public-navigation" className={open ? 'public-nav open' : 'public-nav'} aria-label="Main navigation">
      <Link to="/" aria-current={pathname === '/' && hash !== '#about' ? 'page' : undefined} onClick={() => setOpen(false)}>Home</Link>
      <Link to="/#about" aria-current={pathname === '/' && hash === '#about' ? 'location' : undefined} onClick={() => setOpen(false)}>About</Link>
      <NavLink to="/records" onClick={() => setOpen(false)}>Records</NavLink>
    </nav><ThemeToggle />
  </div></header>
}

export function AdminHeader() {
  const access = useAuth()
  const [help, setHelp] = useState(false)
  const [account, setAccount] = useState(false)
  return <header className="site-header"><div className="admin-header container">
    <Link className="admin-brand" to="/admin/records">Sipi Admin</Link>
    <nav aria-label="Administrator navigation" className="admin-nav">
      <NavLink to="/admin/records" end>Records</NavLink>
      <NavLink to="/admin/records/new">Add record</NavLink>
      <Link to="/admin/records?import=1">Import CSV</Link>
      <button onClick={() => setHelp(true)}>Help</button>
    </nav>
    <div className="header-actions"><ThemeToggle /><button onClick={() => setAccount(true)}>Account</button></div>
  </div>
  {help && <Dialog title="Help with Sipi" onClose={() => setHelp(false)}>
    <p>Use Add record to create a draft. Add authors and advisers in their original order. Save your changes before leaving the form.</p>
    <p>Publishing requires a title, academic year, at least one author and a selected compendium source. Archive records to remove them from public searches; restore them to draft before editing. Use Import CSV to map columns, review names and duplicates, and import selected drafts.</p>
    <SourceNote /><Link to="/">Back to repository</Link>
  </Dialog>}
  {account && <Dialog title="Administrator account" onClose={() => setAccount(false)}><p>{access.email}</p><button onClick={() => { void logOut() }}>Log out</button></Dialog>}
  </header>
}

export function Layout() {
  const access = useAuth()
  const { pathname, hash, key } = useLocation()
  const admin = pathname.startsWith('/admin/records') && access.status === 'approved'
  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>('.site-header')
    if (!header) return
    const measure = () => document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
  }, [pathname, admin])
  useEffect(() => {
    const target = document.getElementById(hash === '#about' ? 'about' : 'main')
    target?.focus({ preventScroll: true })
    if (hash === '#about') target?.scrollIntoView({ block: 'start' })
    else window.scrollTo(0, 0)
  }, [pathname, hash, key])
  return <><a className="skip-link" href="#main">Skip to content</a>
    {admin ? <AdminHeader key={pathname} /> : <PublicHeader key={pathname} />}
    <main id="main" tabIndex={-1} className="container"><Outlet /></main>
    <footer className="site-footer"><div className="container footer-inner">
      <div className="footer-brand"><Logo /><div><p>Computer Engineering</p><p className="muted">PUP Main Campus, Sta. Mesa, Manila</p></div></div>
      <nav className="footer-nav" aria-label="Footer navigation"><Link to="/records">Browse records</Link><Link to="/#about">About Sipi</Link><Link to="/">Back to top</Link></nav>
    </div></footer>
  </>
}

export function RouteError() {
  return <main className="container error-page"><Logo /><h1>We could not load this page.</h1><p>Try opening the repository again.</p><a className="button" href="/">Back to repository</a></main>
}
