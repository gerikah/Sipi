import { PGlite } from '@electric-sql/pglite'
import { readdir, readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { mockAuth } from './auth-fixtures'

export async function managementDatabase(page: Page) {
  await mockAuth(page, true)
  const db = new PGlite()
  const admin = '00000000-0000-4000-8000-000000000001'
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`)
  for (const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'))
  await db.exec(`insert into auth.users values('${admin}'); insert into private.administrators(user_id) values('${admin}');
    insert into public.sources(name) values('Isolated browser test source');
    insert into public.academic_years(start_year,end_year) values(2000,2001);`)
  const behavior = { failSave: false, failRead: false, delaySave: false, saveCalls: 0, dropSaveResponse: false, failPublicRead: false, dropImportResponse: false, importCalls: 0, statusCalls: 0, dropStatusResponse: false }
  await page.route('http://127.0.0.1:54321/rest/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1)!
    if (path === 'is_admin') { await route.fulfill({ json: true }); return }
    if (path === 'save_record') {
      behavior.saveCalls++
      if (behavior.delaySave) await new Promise(resolve=>setTimeout(resolve,250))
      if (behavior.failSave) { await route.fulfill({status:400,json:{code:'23514',message:'Isolated rejected request'}}); return }
    }
    if (path==='commit_import') behavior.importCalls++
    if (path==='set_record_status') behavior.statusCalls++
    if (['search_records','public_record'].includes(path) && behavior.failPublicRead) { await route.fulfill({status:503,json:{code:'PGRST002',message:'Isolated outage'}}); return }
    if (path==='admin_records' && behavior.failRead) { await route.fulfill({status:503,json:{code:'PGRST002',message:'Isolated outage'}}); return }
    try {
      const result = await db.transaction(async tx => {
        await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${admin}',true);`)
        const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {}
        if (path==='search_records') return (await tx.query<{doc: unknown}>('select public.search_records($1,$2,$3,$4,$5,$6) as doc',[body.q,body.year_from,body.year_to,body.topic_id,body.sort,body.page])).rows[0].doc
        if (path==='public_record') return (await tx.query<{doc: unknown}>('select public.public_record($1) as doc',[body.record_id])).rows[0].doc
        if (path==='public_topics') return (await tx.query<{doc: unknown}>('select public.public_topics() as doc')).rows[0].doc
        if (path==='stage_import') return (await tx.query<{doc: unknown}>('select public.stage_import($1,$2,$3,$4,$5,$6) as doc',[body.batch_id,body.source_id,body.filename,body.file_hash,JSON.stringify(body.mapping),JSON.stringify(body.rows)])).rows[0].doc
        if (path==='review_import') return (await tx.query<{doc: unknown}>('select public.review_import($1,$2,$3) as doc',[body.batch_id,body.selected_rows,body.acknowledged_rows])).rows[0].doc
        if (path==='commit_import' || path==='get_import') return (await tx.query<{doc: unknown}>(`select public.${path}($1) as doc`,[body.batch_id])).rows[0].doc
        if (path==='list_imports') return (await tx.query<{doc: unknown}>('select public.list_imports() as doc')).rows[0].doc
        if (path==='admin_records') return (await tx.query<{doc: unknown}>('select public.admin_records($1,$2,$3,$4,$5,$6,$7) as doc',[body.q,body.record_status,body.year_from,body.year_to,body.topic_id,body.sort,body.page])).rows[0].doc
        if (path==='admin_record') return (await tx.query<{doc: unknown}>('select public.admin_record($1::uuid) as doc',[body.record_id])).rows[0].doc
        if (path==='save_record') return (await tx.query<{doc: unknown}>('select public.save_record($1::jsonb,$2::integer) as doc',[JSON.stringify(body.payload),body.expected_version])).rows[0].doc
        if (path==='set_record_status') return (await tx.query<{doc: unknown}>('select public.set_record_status($1::uuid,$2::text,$3::integer) as doc',[body.id,body.status,body.expected_version])).rows[0].doc
        if (path==='save_classification') return (await tx.query<{doc: unknown}>('select public.save_classification($1,$2,$3::uuid,$4) as doc',[body.kind,body.name,body.item_id,body.expected_name])).rows[0].doc
        if (path==='academic_years') return (await tx.query('select id,label from public.academic_years order by start_year desc')).rows
        if (['sources','topics','keywords'].includes(path)) return (await tx.query(`select id,name from public.${path} order by name`)).rows
        throw new Error('Unexpected isolated request')
      })
      if ((path === 'save_record' && behavior.dropSaveResponse) || (path === 'commit_import' && behavior.dropImportResponse) || (path === 'set_record_status' && behavior.dropStatusResponse)) await route.abort('failed')
      else await route.fulfill({json:result})
    } catch (cause) { const error=cause as {code?:string;message:string}; await route.fulfill({status:400,json:{code:error.code || 'TEST_ERROR',message:error.message}}) }
  })
  return { db, behavior }
}
