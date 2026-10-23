// Synthetic data in a disposable local engine; no network or real CSV import.
import { disposableDatabase } from './lib/disposable-db.mjs'
import { writeFile, mkdir } from 'node:fs/promises'
const db = await disposableDatabase()
const admin = '00000000-0000-4000-8000-000000000001', source = '00000000-0000-4000-8000-000000000011'
const call = (sql, args) => db.transaction(async tx => {
  await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${admin}',true);`)
  return (await tx.query(sql, args)).rows[0].doc
})
try {
  await db.exec(`insert into auth.users values('${admin}'); insert into private.administrators(user_id) values('${admin}'); insert into public.sources(id,name) values('${source}','Isolated performance fixture');`)
  const rows = Array.from({ length: 142 }, (_, i) => ({ raw: { thesis_title: `Isolated measured row ${String(i).padStart(3, '0')}` }, errors: [], payload: {
    title: `Isolated measured row ${String(i).padStart(3, '0')}`, academic_year: '2000-2001', authors: ['Isolated first author', 'Isolated second author', 'Isolated third author'],
    advisers: ['Isolated adviser'], panel_members: [], source_archive_id: String(100000 + i), student_number: null,
    abstract: 'Synthetic performance paragraph with no real record information. '.repeat(32), source_created_at: '2026-01-02 03:04:05',
  } }))
  const start = performance.now()
  const batch = await call('select public.stage_import($1,$2,$3,$4,$5,$6) doc', [crypto.randomUUID(), source, 'isolated-performance.csv', 'c'.repeat(64), {}, rows])
  const staged = performance.now()
  if (batch.rows.some(row => row.errors.length)) throw new Error(`Synthetic fixture validation failed: ${JSON.stringify(batch.rows[0].errors)}`)
  await call('select public.review_import($1,$2,$3) doc', [batch.id, batch.rows.map(r => r.row_number), []])
  const reviewed = performance.now()
  const result = await call('select public.commit_import($1) doc', [batch.id])
  const end = performance.now()
  const report = { environment: 'disposable PGlite; not hosted Supabase', rows: rows.length, abstractCharactersPerRow: rows[0].payload.abstract.length, stageMs: Math.round(staged-start), reviewMs: Math.round(reviewed-staged), commitMs: Math.round(end-reviewed), totalMs: Math.round(end-start), importedDrafts: result.imported }
  await mkdir('.local/release', { recursive: true }); await writeFile('.local/release/import-performance.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
} catch (error) {
  console.error(error.message); process.exitCode = 1
} finally { await db.close() }
