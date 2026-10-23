import { test, expect } from '@playwright/test'
import { mockAuth } from './auth-fixtures'
import { managementDatabase } from './management-db'

test('source facets filter the complete published set before pagination and show evidence', async ({ page }) => {
  const { db } = await managementDatabase(page)
  try {
    await db.exec(`insert into public.theses(title,abstract,source_id,academic_year_id,status,published_at)
      select 'Isolated term fixture ' || lpad(n::text,2,'0'),
        case when n=26 then 'Arduino sensors and Android application. Keywords: Remote sensing; Water quality.' else 'No named technology in this source.' end,
        s.id,y.id,'published',now() from generate_series(1,26) n cross join public.sources s cross join public.academic_years y;
      insert into public.theses(title,abstract,status) values('Private fixture','Keywords: Private secret term.','draft');
      insert into public.thesis_authors(thesis_id,full_name,author_order) select id,'Isolated author',1 from public.theses;`)
    await page.goto('/records?sort=title&technology=technology%3Aarduino&keyword=keyword%3Aremote%20sensing&category=both')
    await expect(page.locator('.result-card')).toHaveCount(1)
    const card = page.locator('.result-card')
    await expect(card).toContainText('Isolated term fixture 26')
    await expect(card).toContainText('Hardware + Software')
    await expect(card.locator('.record-tag').first()).toBeVisible()
    const tagGeometry = await card.locator('.record-tag').first().evaluate(el => ({ tag: el.getBoundingClientRect().width, parent: el.parentElement!.getBoundingClientRect().width }))
    expect(tagGeometry.tag).toBeLessThan(tagGeometry.parent)
    await page.getByRole('button', { name: /^Filter/ }).click()
    await expect(page.getByLabel('Mentioned technology')).toBeEnabled()
    await expect(page.getByLabel('Keyword or index term')).not.toContainText('Private secret term')
    await page.keyboard.press('Escape')
    await card.locator('h2 a').click()
    await expect(page.locator('#record-terms')).toContainText('Remote sensing')
    await expect(page.getByText('Why this grouping?', { exact: true })).toHaveCount(0)
    await expect(page.locator('#record-terms .category-tag')).toHaveAttribute('title', /Hardware mentions: arduino, sensors/)
    await page.getByRole('link', { name: 'Back to results', exact: true }).click()
    await expect(page).toHaveURL(/technology=technology%3Aarduino/)
  } finally { await db.close() }
})

test('oversized derived-filter requests fail clearly instead of showing partial counts', async ({ page }) => {
  await mockAuth(page, false)
  await page.route('**/rest/v1/rpc/search_records', route => route.fulfill({ json: { total: 2001, items: [] } }))
  await page.goto('/records?technology=technology%3Aarduino')
  await expect(page.getByText(/Term filters currently support up to 2,000/)).toBeVisible()
  await expect(page.locator('.result-card')).toHaveCount(0)
})

test('responsive margins and centered About text precede the supplied illustrations', async ({ page }, testInfo) => {
  await mockAuth(page, false)
  for (const theme of ['light', 'dark'] as const) for (const width of [1920, 1440, 1024, 768, 390]) {
    await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 })
    await page.goto('/#about')
    await expect(page.locator('#about')).toBeFocused()
    const { copy, images, main } = await page.evaluate(() => ({ copy: document.querySelector('.about-copy')!.getBoundingClientRect().toJSON(), images: document.querySelector('.about-images')!.getBoundingClientRect().toJSON(), main: document.querySelector('main')!.getBoundingClientRect().toJSON() }))
    expect(copy!.y + copy!.height).toBeLessThanOrEqual(images!.y + 1)
    expect(Math.abs(copy!.x + copy!.width / 2 - width / 2)).toBeLessThan(2)
    expect(main!.x).toBeGreaterThanOrEqual(width >= 1280 ? 64 : width >= 960 ? 40 : width >= 640 ? 24 : 16)
    expect(main!.width).toBeLessThanOrEqual(1328)
    expect(await page.locator('.about-copy').evaluate(el => getComputedStyle(el).textAlign)).toBe('center')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    // Scroll each lazy-loaded supplied illustration into view before capturing.
    for (const illustration of await page.locator('.about-images img').all()) {
      await illustration.scrollIntoViewIfNeeded()
      await expect.poll(() => illustration.evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true)
    }
    await page.locator('.about-copy').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`about-${theme}-${width}.png`), fullPage: true })
  }
})
