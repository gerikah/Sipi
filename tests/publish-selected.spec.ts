import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { managementDatabase } from './management-db'

async function setup(page: Page, count: number) {
  const context = await managementDatabase(page)
  await context.db.exec(`insert into public.theses(title,source_id,academic_year_id)
    select 'Isolated publish selection fixture ' || n,s.id,y.id from generate_series(1,${count}) n cross join public.sources s cross join public.academic_years y;
    insert into public.thesis_authors(thesis_id,full_name,author_order) select id,'Isolated fixture author',1 from public.theses;`)
  await page.goto('/admin/records')
  await page.getByRole('checkbox', { name: 'Select all on this page', exact: true }).check()
  return context
}

test('publish selected reviews all pages and exclusions, confirms, locks pending requests and refreshes', async ({ page }, testInfo) => {
  const { db, behavior } = await setup(page, 27)
  try {
    const archived = (await db.query<{ id: string }>('select id from public.theses order by id desc limit 1')).rows[0].id
    await db.query("update public.theses set status='archived' where id=$1", [archived])
    await page.getByRole('button', { name: 'Select all 27 matching records', exact: true }).click()
    const excluded = page.locator('tbody input[type=checkbox]').first()
    const excludedTitle = await excluded.locator('xpath=ancestor::tr').getByRole('rowheader').innerText()
    await excluded.uncheck()
    await page.getByRole('button', { name: 'Publish selected', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('25 selected drafts')
    await expect(page.getByRole('dialog')).toContainText('Already published or archived: 1 record.')
    expect(behavior.statusCalls).toBe(0)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Publish selected', exact: true })).toBeFocused()
    await expect(page.getByRole('group', { name: 'Record selection', exact: true })).toContainText('26 records selected.')
    await page.getByRole('button', { name: 'Publish selected', exact: true }).click()
    const confirm = page.getByRole('button', { name: 'Publish 25 records', exact: true })
    await expect(confirm).toBeEnabled()
    for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
      await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 })
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
      expect(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`publish-selected-${theme}-${width}.png`) })
    }
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route('**/rpc/set_record_status', async route => { await gate; await route.fallback() })
    await confirm.click()
    await expect(page.getByRole('button', { name: 'Publishing…', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Close dialog' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    release()
    await expect(page.getByRole('dialog').getByRole('status')).toHaveText('25 records published.')
    expect(behavior.statusCalls).toBe(25)
    expect((await db.query<{ n: number }>("select count(*)::int n from public.theses where status='published'")).rows[0].n).toBe(25)
    expect((await db.query<{ status: string }>('select status from public.theses where title=$1', [excludedTitle])).rows[0].status).toBe('draft')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Record selection', exact: true })).toContainText('0 records selected.')
    await page.getByRole('button', { name: 'Published', exact: true }).click()
    await expect(page.locator('tbody tr')).toHaveCount(24)
  } finally { await db.close() }
})

test('stale edits stop publishing, report partial success and prevent blind retries', async ({ page }) => {
  const { db, behavior } = await setup(page, 3)
  try {
    await page.getByRole('button', { name: 'Publish selected', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Publish 3 records', exact: true })).toBeEnabled()
    const changed = (await db.query<{ id: string }>('select id from public.theses order by id offset 1 limit 1')).rows[0].id
    await db.query("update public.theses set title='Newer isolated edit' where id=$1", [changed])
    await page.getByRole('button', { name: 'Publish 3 records', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Confirmed published: 1 record.')
    await expect(page.getByRole('alert')).toContainText('changed while you were editing')
    await expect(page.getByRole('button', { name: 'Publish 3 records', exact: true })).toBeDisabled()
    expect(behavior.statusCalls).toBe(2)
    expect((await db.query<{ n: number }>("select count(*)::int n from public.theses where status='draft'")).rows[0].n).toBe(2)
  } finally { await db.close() }
})

test('missing publication fields block confirmation and lost responses require reload', async ({ page }) => {
  const { db, behavior } = await setup(page, 1)
  try {
    await db.exec('update public.theses set academic_year_id=null')
    await page.getByRole('button', { name: 'Publish selected', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Edit these records before publishing')
    await expect(page.getByRole('button', { name: 'Publish 1 record', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await db.exec('update public.theses set academic_year_id=(select id from public.academic_years limit 1)')
    await page.getByRole('button', { name: 'Publish selected', exact: true }).click()
    behavior.dropStatusResponse = true
    await page.getByRole('button', { name: 'Publish 1 record', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('last request may have completed')
    await expect(page.getByRole('button', { name: 'Publish 1 record', exact: true })).toBeDisabled()
    expect(behavior.statusCalls).toBe(1)
    expect((await db.query<{ status: string }>('select status from public.theses')).rows[0].status).toBe('published')
    await page.getByRole('button', { name: 'Close review', exact: true }).click()
    await expect(page.locator('tbody')).toContainText('published')
  } finally { await db.close() }
})

test('administrator revocation after review rejects publishing without changes', async ({ page }) => {
  const { db, behavior } = await setup(page, 2)
  try {
    await page.getByRole('button', { name: 'Publish selected', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Publish 2 records', exact: true })).toBeEnabled()
    await db.exec('update private.administrators set active=false')
    await page.getByRole('button', { name: 'Publish 2 records', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Administrator access could not be verified')
    expect(behavior.statusCalls).toBe(1)
    expect((await db.query<{ n: number }>("select count(*)::int n from public.theses where status='published'")).rows[0].n).toBe(0)
  } finally { await db.close() }
})
