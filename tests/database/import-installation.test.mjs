import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('repair installs skipped import migration after content scope and can be rerun', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant execute on functions to anon,authenticated;`)
  const files = (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()
  for (const file of files.filter(f => !/transactional_imports|repair_import_installation|public_discovery/.test(f))) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'))
  }
  assert.equal((await db.query("select to_regprocedure('public.list_imports()') f")).rows[0].f, null)
  const repair = await readFile(`supabase/migrations/${files.find(f => f.includes('repair_import_installation'))}`, 'utf8')
  await db.exec(repair); await db.exec(repair)
  const admin = '00000000-0000-4000-8000-000000000001'
  await db.exec(`insert into auth.users values('${admin}'); insert into private.administrators(user_id) values('${admin}');`)
  await db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${admin}',true);`)
    assert.deepEqual((await tx.query('select public.list_imports() batches')).rows[0].batches, [])
    await assert.rejects(() => tx.query("select public.stage_import(null,null,'',null,'{}','[]')"), { code: '22023' })
  })
  await assert.rejects(() => db.transaction(async tx => {
    await tx.exec('set local role authenticated'); await tx.query('select public.list_imports()')
  }), { code: '42501' })
  const payload = { title: 'Isolated validation', academic_year: '2000-2001', authors: ['Isolated name'], advisers: [], panel_members: [] }
  const errors = (await db.query("select private.import_row_errors($1,$2,'{}','[]') errors", [payload, { student_number: 'PRIVATE-FIXTURE' }])).rows[0].errors
  assert.match(errors.join(), /verified author mapping/)
  assert.equal((await db.query('select count(*)::int n from private.import_batches')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from public.theses')).rows[0].n, 0)
})
