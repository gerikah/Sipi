import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { disposableDatabase } from '../../scripts/lib/disposable-db.mjs'

test('additive release repair closes actor grants and keeps approved reads and event triggers working', async () => {
  const db = await disposableDatabase()
  try {
    // Reproduce the observed hosted drift without touching the hosted database.
    await db.exec(`grant select on public.theses to anon,authenticated;
      create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path='' as $$ begin return; end $$;
      grant execute on function public.rls_auto_enable() to public,anon,authenticated;
      create event trigger isolated_rls_event on ddl_command_end execute function public.rls_auto_enable();`)
    const old = await readFile('supabase/migrations/20261022141725_preserve_archive_identifier_precision.sql', 'utf8')
    await db.exec(old)
    const repair = await readFile('supabase/migrations/20261023081324_release_access_hardening.sql', 'utf8')
    await db.exec(repair); await db.exec(repair)
    for (const role of ['anon', 'authenticated']) {
      for (const column of ['created_by', 'updated_by']) assert.equal((await db.query(`select has_column_privilege($1,'public.theses',$2,'SELECT') allowed`, [role, column])).rows[0].allowed, false)
      assert.equal((await db.query("select has_function_privilege($1,'public.rls_auto_enable()','EXECUTE') allowed", [role])).rows[0].allowed, false)
    }
    await db.exec('create table public.isolated_event_test(id integer)')
    const admin = '00000000-0000-4000-8000-000000000001'
    await db.exec(`insert into auth.users values('${admin}'); insert into private.administrators(user_id) values('${admin}'); insert into public.theses(title,created_by) values('Isolated repaired fixture','${admin}');`)
    await db.transaction(async tx => {
      await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${admin}',true);`)
      const result = (await tx.query('select public.admin_records() doc')).rows[0].doc
      assert.equal(result.total, 1)
      assert.ok(!('created_by' in result.items[0]))
      assert.equal(result.items[0].title, 'Isolated repaired fixture')
    })
    await assert.rejects(() => db.transaction(async tx => { await tx.exec('set local role anon'); await tx.query('select created_by from public.theses') }), { code: '42501' })
  } finally { await db.close() }
})
