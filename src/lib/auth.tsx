import { useSyncExternalStore } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { sessionStorage, supabase } from './supabase'

type Access = { status: 'checking' | 'signed-out' | 'approved' | 'denied' | 'error' | 'unconfigured'; email?: string; message?: string }
let state: Access = { status: supabase ? 'checking' : 'unconfigured' }
const listeners = new Set<() => void>()
let started = false
let generation = 0
let signingOut = false
let lastSession: Session | null = null
function publish(next: Access) { state = next; listeners.forEach((listener) => listener()) }

async function verify(session: Session | null) {
  if (!supabase || signingOut) return
  const current = ++generation
  lastSession = session
  if (!session) { publish({ status: 'signed-out', message: state.status === 'approved' ? 'Your session expired. Log in again to continue.' : state.message }); return }
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (current !== generation) return
    if (userError || !userData.user) {
      publish({ status: userError && (!userError.status || userError.status >= 500) ? 'error' : 'signed-out', message: userError && (!userError.status || userError.status >= 500) ? 'We could not verify your session. Check your connection and try again.' : 'Your session expired. Log in again to continue.' })
      return
    }
    const { data, error } = await supabase.rpc('is_admin')
    if (current !== generation) return
    if (error) { publish({ status: 'error', message: 'We could not check administrator access. Check your connection or database setup and try again.' }); return }
    publish(data === true ? { status: 'approved', email: userData.user.email } : { status: 'denied', message: 'You do not have access to this page. An active administrator account is required.' })
  } catch {
    if (current === generation) publish({ status: 'error', message: 'We could not verify your session. Check your connection and try again.' })
  }
}

function start() {
  if (started || !supabase) return
  started = true
  supabase.auth.onAuthStateChange((event, session) => {
    if (signingOut) return
    // Never await another Supabase request inside its auth lock.
    if (event === 'SIGNED_OUT') {
      ++generation; lastSession = null
      publish({ status: 'signed-out', message: state.status === 'approved' ? 'Your session expired. Log in again to continue.' : undefined })
    } else setTimeout(() => { void verify(session) }, 0)
  })
  const refresh = () => { if (document.visibilityState === 'visible' && lastSession) void verify(lastSession) }
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
  window.setInterval(refresh, 30_000)
}

export function useAuth() {
  return useSyncExternalStore((listener) => { listeners.add(listener); start(); return () => { listeners.delete(listener) } }, () => state)
}

export async function logIn(email: string, password: string) {
  if (!supabase) return 'Administrator login is not configured yet.'
  ++generation
  publish({ status: 'checking' })
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const message = error.code === 'invalid_credentials' ? 'Email or password is incorrect.' : error.status === 429 ? 'Too many attempts. Wait a moment before trying again.' : 'We could not log you in. Check your connection and account setup, then try again.'
      publish({ status: 'signed-out', message }); return message
    }
    await verify(data.session)
  } catch {
    const message = 'We could not log you in. Check your connection and try again.'
    publish({ status: 'signed-out', message }); return message
  }
}

export async function logOut() {
  signingOut = true; ++generation; lastSession = null
  // Unmount all protected components before any network request or navigation.
  publish({ status: 'signed-out' })
  try {
    const result = await supabase?.auth.signOut({ scope: 'local' })
    if (result?.error) publish({ status: 'signed-out', message: 'Signed out on this device. The server could not confirm session revocation.' })
  } catch {
    publish({ status: 'signed-out', message: 'Signed out on this device. The server could not confirm session revocation.' })
  } finally {
    sessionStorage.removeItem('sipi-auth'); sessionStorage.removeItem('sipi-auth-user'); sessionStorage.removeItem('sipi-auth-code-verifier')
    signingOut = false
  }
}

export function retryAccess() { if (lastSession) void verify(lastSession) }

export function RequireAdmin() {
  const access = useAuth()
  const location = useLocation()
  if (access.status === 'checking') return <section className="page" role="status"><h1>Checking administrator access…</h1></section>
  if (access.status !== 'approved') return <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <Outlet />
}
