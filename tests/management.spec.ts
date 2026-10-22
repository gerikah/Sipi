import { test, expect } from '@playwright/test'
import { managementDatabase } from './management-db'

test('an uncertain save keeps input and prevents a blind retry', async ({ page }) => {
  const { db, behavior } = await managementDatabase(page)
  try {
    await page.goto('/admin/records/new')
    await page.getByLabel('Thesis title *',{exact:true}).fill('Isolated uncertain-save fixture')
    behavior.dropSaveResponse = true
    await page.getByRole('button',{name:'Save draft',exact:true}).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByLabel('Thesis title *',{exact:true})).toHaveValue('Isolated uncertain-save fixture')
    await expect(page.getByRole('button',{name:'Save draft',exact:true})).toBeDisabled()
    expect(behavior.saveCalls).toBe(1)
    expect((await db.query('select * from public.theses')).rows.length).toBe(1)
  } finally { await db.close() }
})

test('isolated database: create, edit ordered relationships, publish, archive and restore through the UI', async ({ page }) => {
  const { db, behavior } = await managementDatabase(page)
  try {
    await page.goto('/admin/records/new')
    await page.getByLabel('Thesis title *', {exact:true}).fill('Isolated browser fixture — test only')
    await page.getByLabel('author 1',{exact:true}).fill('Test author A')
    await page.getByRole('button',{name:'Add author',exact:true}).click()
    await page.getByLabel('author 2',{exact:true}).fill('Test author B')
    await page.getByRole('button',{name:'Move author 2 up'}).click()
    await page.getByLabel('adviser 1',{exact:true}).fill('Test adviser A')
    await page.getByRole('button',{name:'Add adviser',exact:true}).click()
    await page.getByLabel('adviser 2',{exact:true}).fill('Test adviser B')
    await page.getByRole('button',{name:'Move adviser 2 up'}).click()
    await page.getByLabel('Academic year *',{exact:true}).selectOption({label:'2000-2001'})
    await page.getByLabel('Compendium source *',{exact:true}).selectOption({label:'Isolated browser test source'})
    await page.getByLabel('Group code (optional)').fill('001')
    behavior.delaySave = true
    await page.getByRole('button',{name:'Save draft',exact:true}).click()
    await expect(page.getByRole('button',{name:'Saving…',exact:true})).toBeDisabled()
    await expect(page).toHaveURL(/\/admin\/records\/[a-f0-9-]+\/edit$/)
    expect(behavior.saveCalls).toBe(1)
    await expect(page.getByLabel('author 1',{exact:true})).toHaveValue('Test author B')
    await expect(page.getByLabel('adviser 1',{exact:true})).toHaveValue('Test adviser B')
    const record=(await db.query<{id:string;version:number}>('select id,version from public.theses')).rows[0]
    const author=(await db.query<{id:string}>('select id from public.thesis_authors where author_order=1')).rows[0]
    await db.query("insert into private.author_identifiers values($1,'PRIVATE-ISOLATED-ONLY')",[author.id])
    await page.getByRole('button',{name:'Move author 2 up'}).click()
    await page.getByRole('button',{name:'Save draft',exact:true}).click()
    await expect(page.getByRole('status')).toContainText('Draft saved.')
    expect((await db.query('select * from private.author_identifiers')).rows.length).toBe(1)
    await page.getByRole('button',{name:'Review and publish',exact:true}).click()
    await page.getByRole('button',{name:'Publish',exact:true}).click()
    await expect(page.getByRole('status')).toContainText('Record published.')
    await page.getByRole('button',{name:'Archive record',exact:true}).click()
    await page.getByRole('button',{name:'Archive',exact:true}).click()
    await expect(page.getByRole('button',{name:'Restore to draft',exact:true})).toBeVisible()
    await expect(page.getByLabel('Thesis title *',{exact:true})).toBeDisabled()
    await page.getByRole('button',{name:'Restore to draft',exact:true}).click()
    await page.getByRole('button',{name:'Return to draft',exact:true}).click()
    await expect(page.getByLabel('Thesis title *',{exact:true})).toBeEnabled()
    expect((await db.query<{status:string}>('select status from public.theses where id=$1',[record.id])).rows[0].status).toBe('draft')
    await page.getByRole('link',{name:'Back to records',exact:true}).click()
    await expect(page.getByRole('table')).toContainText('Isolated browser fixture')
    await page.getByRole('button',{name:'Published',exact:true}).click()
    await expect(page.getByRole('table')).not.toContainText('Isolated browser fixture')
    await page.getByRole('button',{name:'Drafts',exact:true}).click()
    await expect(page.getByRole('table')).toContainText('Isolated browser fixture')
    await page.getByRole('button',{name:'Filter',exact:true}).click()
    await page.getByLabel('From year').fill('2002')
    await page.getByRole('button',{name:'Apply filters'}).click()
    await expect(page.getByRole('table')).not.toContainText('Isolated browser fixture')
  } finally { await db.close() }
})

test('isolated database: publication validation, failed save preservation and explicit conflict reload', async ({ page }) => {
  const { db, behavior } = await managementDatabase(page)
  try {
    await page.goto('/admin/records/new')
    await page.getByRole('button',{name:'Review and publish'}).click()
    await expect(page.getByLabel('Thesis title *',{exact:true})).toHaveAttribute('aria-invalid','true')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByLabel('Thesis title *',{exact:true}).fill('Isolated conflict fixture')
    behavior.failSave = true
    await page.getByRole('button',{name:'Save draft',exact:true}).click()
    await expect(page.getByRole('alert')).toContainText('Publishing requires')
    await expect(page.getByLabel('Thesis title *',{exact:true})).toHaveValue('Isolated conflict fixture')
    behavior.failSave = false
    await page.getByRole('button',{name:'Save draft',exact:true}).click()
    await expect(page).toHaveURL(/\/edit$/)
    await page.getByLabel('Thesis title *',{exact:true}).fill('Unsaved browser edit')
    await db.exec("update public.theses set title='Newer isolated server edit'")
    await page.getByRole('button',{name:'Save draft',exact:true}).click()
    await expect(page.getByRole('alert')).toContainText('changed while you were editing')
    await expect(page.getByLabel('Thesis title *',{exact:true})).toHaveValue('Unsaved browser edit')
    await expect(page.getByRole('button',{name:'Save draft',exact:true})).toBeDisabled()
    await page.getByRole('button',{name:'Reload latest record',exact:true}).click()
    await page.getByRole('button',{name:'Replace entries and reload'}).click()
    await expect(page.getByLabel('Thesis title *',{exact:true})).toHaveValue('Newer isolated server edit')
    await expect(page.getByRole('button',{name:'Save draft',exact:true})).toBeEnabled()
    await page.getByRole('button',{name:'Manage topics',exact:true}).click()
    await page.getByLabel('Name',{exact:true}).fill('Isolated test topic')
    await page.getByRole('button',{name:'Save classification',exact:true}).click()
    await expect(page.getByRole('checkbox',{name:'Isolated test topic'})).toBeVisible()
    await page.getByRole('checkbox',{name:'Isolated test topic'}).check()
    await page.getByRole('button',{name:'Save draft',exact:true}).click()
    await expect(page.getByRole('status')).toContainText('Draft saved.')
    expect((await db.query('select * from public.thesis_topics')).rows.length).toBe(1)
    await page.getByRole('link',{name:'Back to records',exact:true}).click()
    behavior.failRead=true
    await page.getByRole('button',{name:'Reload records'}).click()
    await expect(page.getByRole('alert')).toContainText('could not complete')
    behavior.failRead=false
    await page.getByRole('button',{name:'Reload records'}).click()
    await expect(page.getByRole('table')).toContainText('Newer isolated server edit')
  } finally { await db.close() }
})
