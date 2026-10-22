import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const routes = ['/', '/about', '/records', '/records/unavailable', '/admin/login', '/admin/records', '/admin/records/new', '/admin/records/unavailable/edit']

test('all layouts support direct links, refresh, both themes and narrow widths', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' })
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const route of routes) {
        await page.goto(route)
        await page.reload()
        await expect(page.locator('main')).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await page.evaluate(async () => {
          await Promise.all([document.fonts.load('600 24px Quicksand'), document.fonts.load('700 40px Quicksand'), document.fonts.load('400 16px Nunito'), document.fonts.load('600 16px Nunito')])
          await document.fonts.ready
        })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        expect(await page.evaluate(() => document.fonts.check('600 24px Quicksand') && document.fonts.check('400 16px Nunito'))).toBe(true)
        const name = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')
        await page.screenshot({ path: testInfo.outputPath(`${name}-${theme}-${width}.png`), fullPage: true })
      }
    }
  }
  expect(errors).toEqual([])
})

test('theme selection persists through navigation and refresh; storage denial is tolerated', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.getByRole('link', { name: 'About', exact: true }).click()
  await expect(page).toHaveURL(/\/#about$/)
  await expect(page.locator('#about')).toBeFocused()
  await expect(page.locator('#about .logo')).toBeInViewport()
  const header = await page.locator('.site-header').boundingBox()
  const about = await page.locator('#about').boundingBox()
  expect(about!.y).toBeGreaterThanOrEqual(header!.y + header!.height)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable') } }) })
  await page.reload()
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('search, filter validation, sort, direct detail return and browser back preserve context', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox').fill('logic & systems')
  await page.getByRole('searchbox').press('Enter')
  await expect(page).toHaveURL(/\/records\?q=logic\+%26\+systems/)
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.getByLabel('From year').fill('2002')
  await page.getByLabel('To year').fill('2001')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.getByRole('alert')).toContainText('start year')
  await page.getByLabel('To year').fill('2003')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await page.getByLabel('Sort records').selectOption('title')
  const searchUrl = page.url()
  await page.goto(searchUrl.replace('/records?', '/records/unavailable?'))
  await page.getByRole('link', { name: 'Back to results' }).click()
  await expect(page).toHaveURL(searchUrl)
  await expect(page.getByRole('searchbox')).toHaveValue('logic & systems')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page).not.toHaveURL(/year_from/)
  await page.goBack()
  await expect(page).toHaveURL(searchUrl)
})

test('dialogs contain keyboard focus, close on Escape and return focus', async ({ page }) => {
  await page.goto('/admin/records')
  const help = page.getByRole('button', { name: 'Help', exact: true })
  await help.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(help).toBeFocused()
})

test('local form reorders names and guards unsaved edits without saving records', async ({ page }) => {
  await page.goto('/admin/records/new')
  await page.getByLabel('Thesis title *', { exact: true }).fill('Local interaction check '.repeat(40))
  await page.getByLabel('author 1', { exact: true }).fill('First test entry')
  await page.getByRole('button', { name: 'Add author', exact: true }).click()
  await page.getByLabel('author 2', { exact: true }).fill('Second test entry')
  await page.getByRole('button', { name: 'Move author 2 up' }).click()
  await expect(page.getByLabel('author 1', { exact: true })).toHaveValue('Second test entry')
  await page.getByRole('link', { name: 'Back to records' }).click()
  await page.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page.getByLabel('author 1', { exact: true })).toHaveValue('Second test entry')
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Review and publish' })).toBeDisabled()
  await page.getByRole('link', { name: 'Back to records' }).click()
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/records$/)
  await page.getByRole('link', { name: 'Add record', exact: true }).first().click()
  await expect(page.getByLabel('Thesis title *', { exact: true })).toHaveValue('')
})

test('mobile navigation, login visibility and status selection work without authentication', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Admin Login', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Records', exact: true }).click()
  await expect(page).toHaveURL(/\/records$/)
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('link', { name: 'About', exact: true }).click()
  await expect(page).toHaveURL(/\/#about$/)
  await expect(page.locator('#about')).toBeFocused()
  await page.goto('/about')
  await expect(page).toHaveURL(/\/#about$/)
  await page.reload()
  await expect(page.locator('#about')).toBeFocused()
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.goto('/admin/login')
  await page.getByLabel('Password', { exact: true }).fill('local-input-check')
  await page.getByRole('checkbox', { name: 'Show password' }).check()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeDisabled()
  await page.getByRole('link', { name: 'Preview record management' }).click()
  await page.getByRole('button', { name: 'Archived', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Archived', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Archived', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Import CSV' })).toBeDisabled()
  const emptyMessage = await page.locator('.table-empty').boundingBox()
  expect(emptyMessage!.x).toBeGreaterThanOrEqual(0)
  expect(emptyMessage!.x + emptyMessage!.width).toBeLessThanOrEqual(390)
})

test('accessible page structure and contrast in both themes', async ({ page }) => {
  test.setTimeout(120_000)
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme })
    for (const route of routes) {
      await page.goto(route)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(results.violations, `${theme} ${route}`).toEqual([])
    }
  }
})
