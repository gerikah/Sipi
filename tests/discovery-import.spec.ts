import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { managementDatabase } from './management-db'

test('public search and direct links use published records, preserve context and recover from errors', async ({ page }, testInfo) => {
  const { db, behavior } = await managementDatabase(page)
  try {
    // Disposable fixtures only; nothing is seeded in the running app or hosted database.
    await db.exec(`insert into public.theses(title,source_id,academic_year_id,status,published_at)
      select 'Isolated discovery fixture ' || n,s.id,y.id,case when n<=26 then 'published' else 'draft' end,case when n<=26 then now() end
      from generate_series(1,27) n cross join public.sources s cross join public.academic_years y;
      insert into public.thesis_authors(thesis_id,full_name,author_order) select id,'Isolated author',1 from public.theses;`)
    await page.goto('/')
    await page.getByRole('searchbox').fill('Isolated discovery')
    await page.getByRole('searchbox').press('Enter')
    await expect(page.locator('.record-grid .record-card')).toHaveCount(24)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.locator('.record-grid .record-card')).toHaveCount(2)
    await expect(page).toHaveURL(/page=2/)
    const searchUrl = page.url()
    await page.getByRole('link', { name: 'View record', exact: true }).first().click()
    await expect(page.locator('.record-detail h1')).toContainText('Isolated discovery fixture')
    await page.reload()
    await expect(page.locator('.record-detail')).toContainText('Isolated author')
    for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
      await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`isolated-public-detail-${theme}-${width}.png`), fullPage: true })
    }
    await page.getByRole('link', { name: 'Back to results' }).click()
    await expect(page).toHaveURL(searchUrl)
    const hidden = (await db.query<{id: string}>("select id from public.theses where status='draft'")).rows[0].id
    await page.goto(`/records/${hidden}`)
    await expect(page.getByRole('heading', { name: 'Record not found.' })).toBeVisible()
    behavior.failPublicRead = true
    await page.goto('/records')
    await expect(page.getByRole('alert')).toContainText('could not load')
    behavior.failPublicRead = false
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('.record-grid .record-card')).toHaveCount(24)
    await page.getByRole('button', { name: 'Filter', exact: true }).click()
    await page.getByLabel('From year').fill('2002')
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page.getByRole('heading', { name: 'No matching records found.' })).toBeVisible()
  } finally { await db.close() }
})

test('CSV workflow preserves corrections, excludes invalid rows and recovers a committed response without duplicates', async ({ page }) => {
  const { db, behavior } = await managementDatabase(page)
  try {
    await page.goto('/admin/records')
    await page.getByRole('link', { name: 'Import CSV', exact: true }).click()
    await page.getByLabel('Compendium source', { exact: true }).selectOption({ label: 'Isolated browser test source' })
    await page.getByLabel('CSV file').setInputFiles({ name: 'isolated-browser-fixture.csv', mimeType: 'text/csv', buffer: Buffer.from('thesis_title,batch_year,author_name,main_adviser,archive_id\r\n"Isolated, import fixture",2000-2001,"First; Second","Adviser A; Adviser B",1\r\nInvalid fixture,2001-2003,Test author,,2') })
    await page.getByRole('button', { name: 'Map columns', exact: true }).click()
    await page.getByLabel('How are authors separated?').selectOption('semicolon')
    await page.getByLabel('How are advisers separated?').selectOption('semicolon')
    await page.getByRole('button', { name: 'Close dialog' }).click()
    await page.getByRole('button', { name: 'Keep reviewing' }).click()
    await expect(page.getByLabel('How are authors separated?')).toHaveValue('semicolon')
    await expect(page.getByLabel('How are advisers separated?')).toHaveValue('semicolon')
    await expect(page.getByRole('combobox', { name: 'Thesis title', exact: true })).toHaveValue('thesis_title')
    await page.getByRole('button', { name: 'Validate and preview' }).click()
    await page.locator('summary').first().click()
    await page.getByLabel('Authors — row 1', { exact: true }).fill('Second\nFirst')
    await page.getByLabel('Authors — row 1', { exact: true }).press('Escape')
    await page.getByRole('button', { name: 'Keep reviewing' }).click()
    await expect(page.getByLabel('Authors — row 1', { exact: true })).toHaveValue('Second\nFirst')
    await expect(page.getByLabel('Authors — row 1', { exact: true })).toBeFocused()
    await expect(page.locator('summary').nth(1)).toContainText('Needs correction or exclusion')
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByLabel('Compendium source', { exact: true })).toHaveValue(/.+/)
    await expect(page.getByText(/CSV ready:/)).toContainText('isolated-browser-fixture.csv · 2 rows')
    await page.getByRole('button', { name: 'Map columns', exact: true }).click()
    await page.getByRole('button', { name: 'Validate and preview' }).click()
    await page.locator('summary').first().click()
    await expect(page.getByLabel('Authors — row 1', { exact: true })).toHaveValue('Second\nFirst')
    await page.getByRole('button', { name: 'Check duplicates' }).click()
    await expect(page.getByRole('checkbox', { name: /Row 1:/ })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /Row 2:/ })).toBeDisabled()
    await page.getByRole('button', { name: 'Close dialog' }).click()
    await page.getByRole('button', { name: 'Leave import', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('link', { name: 'Import CSV', exact: true }).click()
    await page.getByRole('button', { name: 'isolated-browser-fixture.csv — staged' }).click()
    await expect(page.getByRole('checkbox', { name: /Row 1:/ })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /Row 2:/ })).toBeDisabled()
    await page.getByRole('button', { name: 'Confirm selected rows' }).click()
    behavior.dropImportResponse = true
    await page.getByRole('button', { name: 'Import drafts', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Check import status' })).toBeVisible()
    await page.getByRole('button', { name: 'Check import status' }).click()
    await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText('Imported drafts: 1. Skipped rows: 1. Failed rows: 0.')
    expect(behavior.importCalls).toBe(1)
    expect((await db.query('select * from public.theses')).rows).toHaveLength(1)
    expect((await db.query<{full_name: string}>('select full_name from public.thesis_authors order by author_order')).rows.map(r => r.full_name)).toEqual(['Second', 'First'])
    expect((await db.query<{display_name: string}>('select f.display_name from public.thesis_advisers a join public.faculty_members f on f.id=a.faculty_id order by adviser_order')).rows.map(r => r.display_name)).toEqual(['Adviser A', 'Adviser B'])
    expect((await db.query<{status: string}>('select status from public.theses')).rows[0].status).toBe('draft')
    await page.getByRole('button', { name: 'Close summary' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('table')).toContainText('Isolated, import fixture')
    await page.getByRole('link', { name: 'Import CSV', exact: true }).click()
    await page.getByRole('button', { name: 'isolated-browser-fixture.csv — committed' }).click()
    await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible()
  } finally { await db.close() }
})

test('duplicate review blocks existing IDs and requires acknowledgement for similar titles', async ({ page }) => {
  const { db } = await managementDatabase(page)
  try {
    await db.exec("insert into public.theses(title,source_id,source_archive_id) select 'Isolated similar research',id,50 from public.sources")
    await page.setViewportSize({ width: 390, height: 1000 })
    await page.goto('/admin/records?import=1')
    await page.getByLabel('Compendium source', { exact: true }).selectOption({ label: 'Isolated browser test source' })
    await page.getByLabel('CSV file').setInputFiles({ name: 'isolated-duplicates.csv', mimeType: 'text/csv', buffer: Buffer.from('thesis_title,batch_year,author_name,archive_id\nExisting archive,2000-2001,Isolated author,50\nIsolated similar research extended,2000-2001,Isolated author,51') })
    await page.getByRole('button', { name: 'Map columns', exact: true }).click()
    await page.getByLabel('How are authors separated?').selectOption('single')
    await page.getByRole('button', { name: 'Validate and preview' }).click()
    await page.getByRole('button', { name: 'Check duplicates' }).click()
    await expect(page.getByRole('checkbox', { name: /Row 1:/ })).toBeDisabled()
    await expect(page.getByRole('checkbox', { name: /Row 2:/ })).not.toBeChecked()
    await page.getByRole('checkbox', { name: /Row 2:/ }).check()
    await page.getByRole('button', { name: 'Confirm selected rows' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('checkbox', { name: /I compared the warnings/ }).check()
    await page.getByRole('button', { name: 'Confirm selected rows' }).click()
    await expect(page.getByRole('button', { name: 'Import drafts', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Back to review' }).click()
    await expect(page.getByRole('checkbox', { name: /Row 2:/ })).toBeChecked()
    await page.getByRole('button', { name: 'Close dialog' }).click()
    await page.getByRole('button', { name: 'Keep reviewing' }).click()
    await expect(page.getByRole('checkbox', { name: /Row 2:/ })).toBeChecked()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally { await db.close() }
})

test('import empty states and keyboard dialog work in both themes at desktop and mobile widths', async ({ page }, testInfo) => {
  const { db } = await managementDatabase(page)
  try {
    for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
      await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 })
      await page.goto('/admin/records?import=1')
      await expect(page.getByRole('dialog')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations
      expect(violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath(`import-empty-${theme}-${width}.png`), fullPage: true })
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  } finally { await db.close() }
})
