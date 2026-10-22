import { test, expect } from '@playwright/test'
import { mockAuth, submitLogin } from './auth-fixtures'

test('direct protected routes require login; approved sessions restore and logout clears local edits', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/admin/records/new')
  await expect(page).toHaveURL(/\/admin\/login\?next=/)
  await expect(page.getByRole('navigation', { name: 'Administrator navigation' })).toHaveCount(0)
  await submitLogin(page)
  await expect(page).toHaveURL(/\/admin\/records\/new$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Add thesis record' })).toBeVisible()
  await page.getByLabel('Thesis title *', { exact: true }).fill('Unsaved isolated input')
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(page.getByLabel('Thesis title *', { exact: true })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sipi-auth'))).toBeNull()
  await submitLogin(page)
  await expect(page.getByLabel('Thesis title *', { exact: true })).toHaveValue('')
})

test('incorrect credentials, denied membership and connection failures remain outside protected routes', async ({ page }) => {
  const behavior = await mockAuth(page)
  behavior.credentials = false
  await page.goto('/admin/login')
  await submitLogin(page)
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.')
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  behavior.credentials = true; behavior.approved = false
  await submitLogin(page)
  await expect(page.getByRole('alert')).toContainText('active administrator')
  await page.goto('/admin/records')
  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(page.getByRole('navigation', { name: 'Administrator navigation' })).toHaveCount(0)
  behavior.network = true
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sipi-auth'))).toBeNull()
  await submitLogin(page)
  await expect(page.getByRole('alert')).toContainText('connection')
})

test('membership revocation and expired sessions remove the workspace; network failure fails closed', async ({ page }) => {
  const behavior = await mockAuth(page)
  await page.goto('/admin/login')
  await submitLogin(page)
  await expect(page.getByRole('heading', { name: 'Record management' })).toBeVisible()
  behavior.approved = false
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(page.getByRole('alert')).toContainText('active administrator')
  behavior.approved = true
  await submitLogin(page)
  await expect(page.getByRole('heading', { name: 'Record management' })).toBeVisible()
  behavior.network = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(page.getByRole('alert')).toContainText('connection')
  behavior.network = false
  await page.getByRole('button', { name: 'Try access check again' }).click()
  await expect(page.getByRole('heading', { name: 'Record management' })).toBeVisible()
  behavior.expired = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(page.getByRole('alert')).toContainText('session expired')
})

test('offline logout clears persistence; login next cannot redirect off-site', async ({ page }) => {
  const behavior = await mockAuth(page)
  await page.goto('/admin/login?next=https://example.invalid')
  await submitLogin(page)
  await expect(page).toHaveURL(/\/admin\/records$/)
  behavior.logoutFailure = true
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sipi-auth'))).toBeNull()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Admin login' })).toBeVisible()
})
