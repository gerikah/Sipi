import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockAuth } from './auth-fixtures'

const fixture = { name: 'isolated-feedback.csv', mimeType: 'text/csv', buffer: Buffer.from('thesis_title,batch_year,author_name\nIsolated feedback fixture,2000-2001,Isolated author') }

test('cancelling dismissal retains the selected file and parsed rows without sources', async ({ page }) => {
  await mockAuth(page, true)
  await page.goto('/admin/records?import=1')
  await page.getByLabel('CSV file', { exact: true }).setInputFiles(fixture)
  await expect(page.getByRole('dialog')).toContainText('isolated-feedback.csv')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Keep reviewing' }).click()
  expect(await page.getByLabel('CSV file', { exact: true }).evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe(fixture.name)
  await expect(page.getByRole('status').filter({ hasText: 'CSV ready:' })).toHaveText('CSV ready: isolated-feedback.csv · 1 rows')
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused()
  await expect(page.getByLabel('Compendium source', { exact: true })).toBeDisabled()
  await expect(page.getByText('No compendium source is configured. A source must be added before you can continue.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Map columns', exact: true })).toBeDisabled()
  await expect(page.locator('#import-next-reason')).toHaveText('Source required before continuing')
  await page.getByLabel('CSV file', { exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Leave this import?', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('CSV file', { exact: true })).toBeFocused()
  await expect(page.getByRole('status').filter({ hasText: 'CSV ready:' })).toContainText('1 rows')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Leave import', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('link', { name: 'Import CSV', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toContainText(fixture.name)
  expect(await page.getByLabel('CSV file', { exact: true }).evaluate((input: HTMLInputElement) => input.files?.length)).toBe(0)
})

test('invalid replacement clears stale parsed rows and explains how to fix the file', async ({ page }) => {
  await mockAuth(page, true)
  await page.goto('/admin/records?import=1')
  await page.getByLabel('CSV file', { exact: true }).setInputFiles(fixture)
  await expect(page.getByText(/CSV ready:/)).toBeVisible()
  await page.getByLabel('CSV file', { exact: true }).setInputFiles({ ...fixture, name: 'invalid-fixture.csv', buffer: Buffer.from('title,author\n"unterminated') })
  await expect(page.getByRole('alert')).toContainText('File validation failed:')
  await expect(page.getByRole('alert')).toContainText('Correct the file and select it again.')
  await expect(page.getByText(/CSV ready:/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Keep reviewing' }).click()
  await expect(page.getByRole('alert')).toContainText('File validation failed:')
  await page.getByLabel('CSV file', { exact: true }).setInputFiles(fixture)
  await expect(page.getByText(/CSV ready:/)).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('reading progress protects against closing until the local read finishes', async ({ page }) => {
  await mockAuth(page, true)
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer
    let finish: () => void
    const gate = new Promise<void>(resolve => { finish = resolve })
    Object.assign(window, { finishCsvRead: () => finish() })
    File.prototype.arrayBuffer = async function () { await gate; return original.call(this) }
  })
  await page.goto('/admin/records?import=1')
  await page.getByLabel('CSV file', { exact: true }).setInputFiles(fixture)
  await expect(page.getByRole('status').filter({ hasText: 'Reading CSV…' })).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Import CSV', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Leave this import?', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Map columns', exact: true })).toBeDisabled()
  await page.evaluate(() => (window as unknown as { finishCsvRead: () => void }).finishCsvRead())
  await expect(page.getByText(/CSV ready:/)).toBeVisible()
})

test('source reload retains the local file and does not depend on recent batches', async ({ page }) => {
  await mockAuth(page, true)
  let sourcesAvailable = false
  await page.route('**/rest/v1/sources?*', route => route.fulfill({ json: sourcesAvailable ? [{ id: '00000000-0000-4000-8000-000000000005', name: 'Isolated configured source' }] : [] }))
  await page.route('**/rest/v1/rpc/list_imports', route => route.fulfill({ status: 503, json: { message: 'Isolated unavailable service' } }))
  await page.goto('/admin/records?import=1')
  await page.getByLabel('CSV file', { exact: true }).setInputFiles(fixture)
  await expect(page.getByText(/CSV ready:/)).toBeVisible()
  await expect(page.getByLabel('Compendium source', { exact: true })).toBeDisabled()
  sourcesAvailable = true
  await page.getByRole('button', { name: 'Reload sources', exact: true }).click()
  await page.getByLabel('Compendium source', { exact: true }).selectOption({ label: 'Isolated configured source' })
  await expect(page.getByRole('button', { name: 'Map columns', exact: true })).toBeEnabled()
  await expect(page.getByText(/CSV ready:/)).toContainText(fixture.name)
})

test('missing-source feedback and leave confirmation fit both themes and screen widths', async ({ page }, testInfo) => {
  await mockAuth(page, true)
  for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
    await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 })
    await page.goto('/admin/records?import=1')
    await page.getByLabel('CSV file', { exact: true }).setInputFiles(fixture)
    await expect(page.getByText(/CSV ready:/)).toBeVisible()
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
    expect(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`import-feedback-${theme}-${width}.png`), fullPage: true })
    await page.locator('#import-next-reason').scrollIntoViewIfNeeded()
    await expect(page.locator('#import-next-reason')).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath(`import-next-step-${theme}-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Close dialog' }).click()
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`import-leave-${theme}-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Leave import', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
})
