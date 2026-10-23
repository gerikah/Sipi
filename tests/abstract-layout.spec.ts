import { test, expect } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { parseCsv } from '../src/lib/csv'
import { abstractParagraphs } from '../src/lib/abstract'
import { mockAuth } from './auth-fixtures'

test('every available source abstract keeps all text and its ending reachable in the reader', async ({ page }, testInfo) => {
  test.setTimeout(240_000)
  let source: string
  try { source = await readFile('cpe_thesis_repository.csv', 'utf8') }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; test.skip(true, 'Ignored CSV unavailable; long-content fixtures remain covered.'); return }
  const csv = parseCsv(source)
  const records = csv.rows.map((row, index) => {
    const cells = Object.fromEntries(csv.headers.map((header, i) => [header, row[i]]))
    return { id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, title: cells.thesis_title, abstract: cells.abstract,
      academicYear: cells.batch_year, authors: [], advisers: [], panel_members: [], source_name: 'CPE Department Compendium', source_archive_id: cells.archive_id, source_created_at: cells.created_at, group_code: null, section_block: cells.section_block }
  })
  await mockAuth(page, false)
  await page.route('**/rest/v1/rpc/search_records', route => route.fulfill({ json: { total: 0, page: 1, items: [] } }))
  await page.route('**/rest/v1/rpc/public_record', route => route.fulfill({ json: records.find(r => r.id === route.request().postDataJSON().record_id) }))
  let checked = 0
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [index, record] of records.entries()) {
      await page.emulateMedia({ colorScheme: index % 2 ? 'dark' : 'light' })
      const paragraphs = abstractParagraphs(record.abstract)
      expect(paragraphs.join(' ')).toBe(record.abstract.replace(/\s+/g, ' ').trim())
      await page.goto(`/records/${record.id}`)
      const text = page.locator('.abstract-text')
      await expect(text.locator('p')).toHaveText(paragraphs)
      await text.locator('p').last().scrollIntoViewIfNeeded()
      await expect(text.locator('p').last()).toBeInViewport()
      expect(await text.evaluate(el => getComputedStyle(el).overflowY)).toBe('visible')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      // The ending of a long last paragraph must fit inside the scroll range,
      // not merely have its beginning appear inside the viewport.
      const geometry = await page.locator('.record-detail').evaluate(el => {
        el.scrollTop = el.scrollHeight
        const end = el.querySelector('.abstract-text p:last-child')!.getBoundingClientRect().bottom
        return { end, panelBottom: el.getBoundingClientRect().bottom }
      })
      expect(geometry.end).toBeLessThanOrEqual(geometry.panelBottom + 1)
      if (index === 0) await page.screenshot({ path: testInfo.outputPath(`source-abstract-${width}.png`) })
      checked++
    }
  }
  await mkdir('.local/release', { recursive: true })
  await writeFile('.local/release/abstract-layout-review.json', JSON.stringify({ sourceRows: records.length, renderedChecks: checked, widths: [1440, 390], originalTextPreservedIgnoringWhitespace: true, remoteWrites: 0 }, null, 2))
})

test('export line wraps flow into paragraphs without inventing text or splitting names', () => {
  expect(abstractParagraphs('First source line\r\ncontinues here.\r\n\r\nSecond paragraph.\nKeywords: sensors,\nwater.'))
    .toEqual(['First source line continues here.', 'Second paragraph.', 'Keywords: sensors, water.'])
})
