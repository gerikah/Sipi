import { createClient } from '@supabase/supabase-js'

// Storage denial does not break public pages; sessions then last for this tab.
const memory = new Map<string, string>()
export const sessionStorage = {
  getItem(key: string) {
    try { return localStorage.getItem(key) } catch { return memory.get(key) ?? null }
  },
  setItem(key: string, value: string) {
    memory.set(key, value)
    try { localStorage.setItem(key, value) } catch { /* In-memory session only. */ }
  },
  removeItem(key: string) {
    memory.delete(key)
    try { localStorage.removeItem(key) } catch { /* Already unavailable. */ }
  },
}

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
const validUrl = (() => {
  try { const value = new URL(url); return value.protocol === 'https:' || (value.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(value.hostname)) } catch { return false }
})()
export const supabase = validUrl && key ? createClient(url, key, {
  auth: { storageKey: 'sipi-auth', storage: sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000) }) },
}) : null
