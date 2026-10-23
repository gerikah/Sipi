import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { disposableDatabase } from '../../scripts/lib/disposable-db.mjs'

test('isolated PGlite backup restores ordered data, permissions, audit and completed import retry identity', async () => {
  let db = await disposableDatabase()
  const admin = '00000000-0000-4000-8000-000000000001'
  const source = '00000000-0000-4000-8000-000000000011'
  const batch = crypto.randomUUID()
  const call = async (sql, args = [], role = 'authenticated') => db.transaction(async tx => {
    await tx.exec(`set local role ${role}; select set_config('request.jwt.claim.sub','${role === 'authenticated' ? admin : ''}',true);`)
    return (await tx.query(sql, args)).rows[0]?.doc
  })
  try {
    await db.exec(`insert into auth.users values('${admin}'); insert into private.administrators(user_id) values('${admin}');
      insert into public.sources(id,name) values('${source}','Isolated recovery fixture source');`)
    const input = [{ raw: { thesis_title: 'Isolated recovery fixture' }, errors: [], payload: {
      title: 'Isolated recovery fixture', academic_year: '2000-2001', authors: ['Second fixture name', 'First fixture name'],
      advisers: [], panel_members: [], source_archive_id: '9223372036854775807', source_created_at: '2026-01-02 03:04:05', student_number: null,
    } }]
    await call('select public.stage_import($1,$2,$3,$4,$5,$6) doc', [batch, source, 'isolated-recovery.csv', 'b'.repeat(64), {}, input])
    await call('select public.review_import($1,$2,$3) doc', [batch, [1], []])
    const summary = await call('select public.commit_import($1) doc', [batch])
    const audits = (await db.query('select count(*)::int n from private.audit_logs')).rows[0].n
    const archive = await db.dumpDataDir()
    await db.close()
    db = new PGlite({ loadDataDir: archive })
    assert.deepEqual(await call('select public.commit_import($1) doc', [batch]), summary)
    assert.equal((await db.query('select count(*)::int n from public.theses')).rows[0].n, 1)
    assert.equal((await db.query('select count(*)::int n from private.audit_logs')).rows[0].n, audits)
    const record = await call('select public.admin_record($1) doc', [summary.rows[0].thesis_id])
    assert.equal(record.source_archive_id, '9223372036854775807')
    assert.deepEqual(record.authors.map(a => a.full_name), ['Second fixture name', 'First fixture name'])
    assert.equal((await call('select public.search_records() doc', [], 'anon')).total, 0)
    await assert.rejects(() => call('select * from private.import_rows', [], 'anon'), { code: '42501' })
    await assert.rejects(() => call('select private.cleanup_imports() doc', [], 'authenticated'), { code: '42501' })
  } finally { await db.close() }
})
