import type { Page } from '@playwright/test'

export async function mockAuth(page: Page, seed = false) {
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'administrator@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const expires = Math.floor(Date.now() / 1000) + 3600
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: expires, role: 'authenticated' })).toString('base64url'), 'test-signature'].join('.')
  const session = { access_token: token, refresh_token: 'isolated-refresh-token', expires_in: 3600, expires_at: expires, token_type: 'bearer', user }
  const behavior = { approved: true, credentials: true, network: false, expired: false, logoutFailure: false }
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (behavior.network) { await route.abort('failed'); return }
    if (path.endsWith('/token')) await route.fulfill({ headers: { 'x-supabase-api-version': '2024-01-01', 'access-control-expose-headers': 'x-supabase-api-version' }, status: behavior.credentials ? 200 : 400, json: behavior.credentials ? session : { code: 'invalid_credentials', msg: 'Invalid login credentials' } })
    else if (path.endsWith('/user')) await route.fulfill({ headers: { 'x-supabase-api-version': '2024-01-01', 'access-control-expose-headers': 'x-supabase-api-version' }, status: behavior.expired ? 401 : 200, json: behavior.expired ? { code: 'session_not_found', msg: 'Session expired' } : user })
    else if (path.endsWith('/is_admin')) await route.fulfill({ json: behavior.approved })
    else if (path.endsWith('/admin_records')) await route.fulfill({ json: { items: [], total: 0, page: 1 } })
    else if (path.endsWith('/admin_record')) await route.fulfill({ json: null })
    else if (['/academic_years','/sources','/topics','/keywords'].some(name => path.endsWith(name))) await route.fulfill({ json: [] })
    else if (path.endsWith('/logout')) await route.fulfill({ status: behavior.logoutFailure ? 503 : 204, body: '' })
    else await route.fulfill({ status: 404, json: { message: 'Unexpected test request' } })
  })
  if (seed) await page.addInitScript((value) => {
    // Phase 1 visual checks use an isolated approved session on workspace pages.
    if (location.pathname === '/admin/login') localStorage.removeItem('sipi-auth')
    else localStorage.setItem('sipi-auth', JSON.stringify(value))
  }, session)
  return behavior
}

export async function submitLogin(page: Page) {
  await page.getByLabel('Email address', { exact: true }).fill('administrator@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill('isolated-test-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
}
