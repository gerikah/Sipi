import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { managementDatabase } from './management-db'

test('compact cards and a fixed record reader preserve full text and search context', async ({ page }, testInfo) => {
  const { db } = await managementDatabase(page)
  try {
    const abstract = 'Isolated reading fixture. This paragraph checks that every word stays available when the viewport changes. '.repeat(75) + 'END OF ISOLATED ABSTRACT.'
    await db.exec(`insert into public.theses(title,source_id,academic_year_id,status,published_at)
      select 'Isolated reading fixture ' || n || case when n=1 then ' with a considerably longer title for consistent card geometry' else '' end,s.id,y.id,'published',now()
      from generate_series(1,26) n cross join public.sources s cross join public.academic_years y;
      insert into public.thesis_authors(thesis_id,full_name,author_order) select id,'Isolated Maria de la Cruz',1 from public.theses;
      insert into public.thesis_authors(thesis_id,full_name,author_order) select id,'Isolated Second Author',2 from public.theses;
      insert into public.faculty_members(display_name) values('Isolated adviser');
      insert into public.thesis_advisers(thesis_id,faculty_id,adviser_order) select t.id,f.id,1 from public.theses t cross join public.faculty_members f;`)
    await db.query('update public.theses set abstract=$1', [abstract])
    await page.goto('/records?q=Isolated%20reading&sort=title')
    await expect(page.locator('.result-card')).toHaveCount(24)
    const first = page.locator('.result-card').first()
    await expect(first).toContainText('Isolated Maria de la Cruz, et al.')
    await expect(first).not.toContainText('Isolated Second Author')
    await expect(first).toContainText('Adviser: Isolated adviser')
    await expect(page.locator('h1')).toHaveClass('sr-only')
    const url = page.url()
    const recordUrl = await first.locator('h2 a').getAttribute('href')
    for (const theme of ['light', 'dark'] as const) for (const width of [1440, 768, 390]) {
      await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 900 })
      await page.goto(url)
      await expect(first).toBeVisible()
      const heights = await page.locator('.result-card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().height))
      expect(Math.max(...heights)).toBeLessThan(448)
      await page.screenshot({ path: testInfo.outputPath(`cards-${theme}-${width}.png`) })
      await first.locator('h2 a').click()
      await expect(page.locator('.record-detail')).toContainText('END OF ISOLATED ABSTRACT.')
      await expect(page.getByRole('searchbox')).toHaveCount(0)
      await expect(page.locator('.site-header .logo')).toBeVisible()
      const actions = page.locator('.record-view-actions')
      await expect(actions.getByRole('button', { name: 'Copy record link' })).toBeVisible()
      await expect(actions.locator('.back-link svg')).toBeVisible()
      const geometry = await page.evaluate(() => ({
        viewport: innerHeight, document: document.documentElement.scrollHeight,
        detailOverflow: getComputedStyle(document.querySelector('.record-detail')!).overflowY,
        horizontal: document.documentElement.scrollWidth <= innerWidth,
      }))
      expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
      expect(geometry.horizontal).toBe(true)
      expect(geometry.detailOverflow).toBe('auto')
      const panels = await page.evaluate(() => {
        const metadata = document.querySelector('.detail-metadata')!, source = document.querySelector('.record-detail .source-panel')!, tags = document.querySelector('.record-terms')!
        return { metadata: metadata.getBoundingClientRect().toJSON(), source: source.getBoundingClientRect().toJSON(), tags: tags.getBoundingClientRect().toJSON(),
          metadataColor: getComputedStyle(metadata).backgroundColor, sourceColor: getComputedStyle(source).backgroundColor }
      })
      expect(panels.sourceColor).toBe(panels.metadataColor)
      if (width > 640) {
        expect(Math.abs(panels.source.x - panels.metadata.x)).toBeLessThan(1)
        expect(Math.abs(panels.source.width - panels.metadata.width)).toBeLessThan(1)
        expect(Math.abs(panels.source.y - panels.tags.y)).toBeLessThan(1)
        expect(panels.tags.x).toBeLessThan(panels.source.x)
      }
      const details = page.getByRole('region', { name: 'Thesis details' })
      expect(await details.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath(`reader-${theme}-${width}.png`) })
      await page.locator('.record-detail .source-panel').scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`source-tags-${theme}-${width}.png`) })
      await details.evaluate(el => { el.scrollTop = 0 })
      await details.focus(); await page.keyboard.press('PageDown')
      await expect.poll(() => details.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
      if (width < 960) await page.getByRole('button', { name: 'Results', exact: true }).click()
      const results = page.locator('.supporting-results')
      await expect(results).toBeVisible()
      expect(await results.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
      await results.evaluate(el => { el.scrollTop = 250 })
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      if (width < 960) await page.getByRole('button', { name: 'Thesis', exact: true }).click()
      await page.getByRole('link', { name: 'Back to results', exact: true }).click()
      await expect(page).toHaveURL(url)
    }
    await page.goto(recordUrl!)
    // Every original word stays in the reader, including the ending and provenance.
    await expect(page.locator('.abstract-text')).toHaveText(abstract.trim())
    await expect(page.locator('.detail-metadata .public-people').first().locator('li')).toHaveText(['Isolated Maria de la Cruz', 'Isolated Second Author'])
    await expect(page.locator('.detail-metadata')).toContainText('Adviser')
    await expect(page.locator('.detail-metadata')).not.toContainText('Main adviser')
    await page.locator('.record-detail .source-panel').scrollIntoViewIfNeeded()
    await expect(page.locator('.record-detail .source-panel')).toBeInViewport()
    await page.getByRole('button', { name: 'Results', exact: true }).click()
    await page.locator('.supporting-results a:not([aria-current])').first().click()
    await expect(page.locator('.record-detail h1')).toBeInViewport()
    expect(await page.locator('.record-detail').evaluate(el => el.scrollTop)).toBe(0)
  } finally { await db.close() }
})
