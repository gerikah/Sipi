// A new, empty browser context: no saved user session, sign-in or writes.
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
const origin = 'https://sipii.netlify.app'
const dir = '.local/release'
await mkdir(dir, { recursive: true })
const detail = (await readFile(`${dir}/published-detail-path.txt`, 'utf8')).trim()
if (!/^\/records\/[0-9a-f-]{36}$/.test(detail)) throw new Error('Run the read-only API check first.')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = { checkedAt: new Date().toISOString(), layouts: [], routes: [], pageErrors: 0 }
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', () => { report.pageErrors++ })
  for (const route of ['/admin/records', '/admin/records/new', `${detail}/edit`.replace('/records/', '/admin/records/')]) {
    await page.goto(origin + route)
    await page.waitForURL('**/admin/login?next=*')
    report.routes.push({ route: route.includes('/edit') ? '/admin/records/:id/edit' : route, signedOutRedirect: page.url().startsWith(`${origin}/admin/login?next=`) })
  }
  for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
    await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 })
    for (const [name, path] of [['records', '/records'], ['detail', detail], ['login', '/admin/login']]) {
      const response = await page.goto(origin + path)
      await page.reload()
      await page.locator('main').waitFor()
      if (name === 'records') await page.locator('.record-card, .result-card').first().waitFor()
      if (name === 'detail') await page.locator('.record-detail h1').waitFor()
      await page.evaluate(() => document.fonts.ready)
      const checks = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, bodyScroll: document.documentElement.scrollHeight > innerHeight }))
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      report.layouts.push({ name, width, requestedTheme: theme, status: response.status(), ...checks, accessibilityViolations: axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })) })
      await page.screenshot({ path: `${dir}/hosted-${name}-${theme}-${width}.png` })
    }
  }
  await page.goto(origin + '/records/00000000-0000-4000-8000-000000000000')
  await page.getByRole('heading', { name: 'Record not found.' }).waitFor()
  report.missingRecordHidden = true
  await context.close()
} finally { await browser.close() }
await writeFile(`${dir}/hosted-browser-check.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
