import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('public discovery and transactional imports in disposable PostgreSQL', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant execute on functions to anon,authenticated;`)
  for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'))
  const admin = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002', ordinary = '00000000-0000-4000-8000-000000000003'
  const source = '00000000-0000-4000-8000-000000000011'
  await db.exec(`insert into auth.users values('${admin}'),('${other}'),('${ordinary}'); insert into private.administrators(user_id) values('${admin}'),('${other}'); insert into public.sources(id,name) values('${source}','Isolated import test source');`)
  async function as(sql, args = [], user = admin, role = 'authenticated') {
    return db.transaction(async tx => {
      await tx.exec(`set local role ${role}; select set_config('request.jwt.claim.sub','${user || ''}',true);`)
      return (await tx.query(sql, args)).rows[0]?.doc
    })
  }
  const row = (title, archive = null, overrides = {}) => ({ raw: { title }, errors: [], payload: { title, academic_year: '2000-2001', authors: ['First fixture author', 'Second fixture author'], advisers: ['First fixture adviser', 'Second fixture adviser'], panel_members: [], group_code: '001', section_block: 'A', source_created_at: '2026-01-02 03:04:05', source_archive_id: archive, abstract: null, student_number: null, ...overrides } })
  const stage = (rows, id = crypto.randomUUID(), user = admin, role = 'authenticated') => as('select public.stage_import($1,$2,$3,$4,$5,$6) doc', [id, source, 'isolated-fixture.csv', 'a'.repeat(64), {}, rows], user, role)
  const review = (id, selected, ack = [], user = admin) => as('select public.review_import($1,$2,$3) doc', [id, selected, ack], user)
  const commit = (id, user = admin, role = 'authenticated') => as('select public.commit_import($1) doc', [id], user, role)
  const get = (id, user = admin) => as('select public.get_import($1) doc', [id], user)
  const count = async table => (await db.query(`select count(*)::int n from ${table}`)).rows[0].n
  let first, importedId
  await t.test('source-only drafts publish with optional metadata absent, and unmapped student numbers remain blocked', async () => {
    const minimal = row('Isolated minimal source', '9007199254740993', { advisers: [], panel_members: [], group_code: null, section_block: null, source_created_at: null, abstract: null })
    const blocked = row('Isolated unmapped identifier', '90'); blocked.raw.student_number = 'PRIVATE-UNMAPPED-FIXTURE'
    const batch = await stage([minimal, blocked])
    assert.match(batch.rows[1].errors.join(), /student_number/)
    await assert.rejects(() => review(batch.id, [2]), { code: '22023' })
    await review(batch.id, [1]); const summary = await commit(batch.id); const id = summary.rows[0].thesis_id
    assert.equal(await count('public.thesis_topics'), 0); assert.equal(await count('public.thesis_keywords'), 0)
    await as("select public.set_record_status($1,'published',1) doc", [id])
    const doc = await as('select public.public_record($1) doc', [id], null, 'anon')
    assert.equal(doc.source_archive_id, '9007199254740993')
    assert.equal(doc.abstract, null); assert.deepEqual(doc.advisers, []); assert.deepEqual(doc.panel_members, [])
    for (const key of ['topics', 'keywords', 'student_number', 'created_at', 'updated_at']) assert.ok(!(key in doc))
    await db.exec("insert into public.topics(name) values('Legacy classification'); insert into public.keywords(name) values('LegacyOnlySearchToken')")
    await db.query('insert into public.thesis_topics select $1,id from public.topics', [id])
    await db.query('insert into public.thesis_keywords select $1,id from public.keywords', [id])
    const edited = await as('select public.save_record($1,2) doc', [{ id, title: 'Isolated minimal edited source' }])
    assert.equal(await count('public.thesis_topics'), 1); assert.equal(await count('public.thesis_keywords'), 1)
    assert.equal((await as("select public.search_records(q=>'LegacyOnlySearchToken') doc", [], null, 'anon')).total, 0)
    assert.equal((await as("select public.admin_records(q=>'LegacyOnlySearchToken') doc")).total, 0)
    assert.equal((await as("select public.search_records(topic_id=>'00000000-0000-4000-8000-000000000099') doc", [], null, 'anon')).total, 1)
    await as("select public.set_record_status($1,'archived',$2) doc", [id, edited.version])
  })
  await t.test('staging is owner-only, validates fields, preserves provenance and commits ordered drafts once', async () => {
    const id = crypto.randomUUID(), inputs = [row('Isolated Alpha research', '9223372036854775807'), row('Invalid year', '2', { academic_year: '2001-2003' }), row('Private identifier', '3', { student_number: 'PRIVATE-TEST-ONLY' })]
    first = await stage(inputs, id)
    assert.equal(first.invalid, 2); assert.match(first.rows[1].errors.join(), /academic_year/); assert.match(first.rows[2].errors.join(), /student_number/)
    assert.equal(JSON.stringify(first).includes('PRIVATE-TEST-ONLY'), false)
    assert.deepEqual(await stage(inputs, id), first)
    await assert.rejects(() => stage([row('Changed payload')], id), { code: '22023' })
    for (const user of [other, ordinary]) {
      await assert.rejects(() => get(id, user), { code: '42501' })
      await assert.rejects(() => commit(id, user), { code: '42501' })
      await assert.rejects(() => review(id, [1], [], user), { code: '42501' })
    }
    await assert.rejects(() => stage(inputs, crypto.randomUUID(), ordinary), { code: '42501' })
    await assert.rejects(() => stage(inputs, crypto.randomUUID(), null, 'anon'), { code: '42501' })
    await assert.rejects(() => commit(id, null, 'anon'), { code: '42501' })
    await assert.rejects(() => review(id, [2]), { code: '22023' })
    await review(id, [1]); first = await commit(id); importedId = first.rows[0].thesis_id
    assert.equal(first.imported, 1); assert.equal(first.skipped, 2); assert.equal(first.failed, 0)
    assert.deepEqual(await commit(id), first)
    assert.equal(await count('public.theses'), 2)
    const doc = await as('select public.admin_record($1) doc', [importedId])
    assert.equal(doc.status, 'draft'); assert.equal(doc.source_archive_id, '9223372036854775807'); assert.equal(doc.group_code, '001')
    assert.equal(doc.source_created_at, '2026-01-02T03:04:05')
    assert.deepEqual(doc.authors.map(a => a.full_name), inputs[0].payload.authors)
    assert.deepEqual(doc.advisers.map(a => a.display_name), inputs[0].payload.advisers)
    assert.equal((await db.query('select actor_id from private.audit_logs where batch_id=$1 and action=$2', [id, 'import_committed'])).rows[0].actor_id, admin)
  })
  await t.test('duplicate review covers source identifiers, similar titles and repeated file identifiers', async () => {
    const b = await stage([row('Existing source archive', '9223372036854775807'), row('Isolated Alpha research extended', '5'), row('Same archive first', '6'), row('Same archive second', '6')])
    assert.equal(b.rows[0].duplicates[0].kind, 'existing_id'); assert.equal(b.rows[0].decision, 'skip')
    assert.ok(b.rows[1].duplicates.some(d => d.kind === 'similar_title'))
    assert.ok(b.rows[1].duplicates.some(d => d.same_year && d.same_authors))
    const different = await stage([row('Isolated Alpha research comparison', '7', { academic_year: '2002-2003', authors: ['Different fixture author'] })])
    assert.ok(different.rows[0].duplicates.some(d => d.kind === 'similar_title' && !d.same_year && !d.same_authors))
    await assert.rejects(() => review(b.id, [1], [1]), { code: '23505' })
    await assert.rejects(() => review(b.id, [2]), { code: '22023' })
    await assert.rejects(() => review(b.id, [3, 4], [3, 4]), { code: '23505' })
    await review(b.id, [2, 3], [2, 3]); const result = await commit(b.id)
    assert.equal(result.imported, 2); assert.equal(result.skipped, 2)
  })
  await t.test('a forced second-row failure rolls back records, faculty, years, audit and batch results', async () => {
    const b = await stage([row('Rollback A', '20', { academic_year: '2002-2003' }), row('Rollback B', '21', { academic_year: '2002-2003' })])
    await review(b.id, [1, 2]); const tables = ['public.theses', 'public.faculty_members', 'public.academic_years', 'private.audit_logs']
    const before = await Promise.all(tables.map(count))
    await db.exec(`create function private.test_fail_import() returns trigger language plpgsql as $$ begin if new.title='Rollback B' then raise exception 'Isolated forced failure'; end if; return new; end; $$;
      create trigger test_fail_import before insert on public.theses for each row execute function private.test_fail_import();`)
    await assert.rejects(() => commit(b.id), { code: 'P0001' })
    assert.deepEqual(await Promise.all(tables.map(count)), before)
    assert.equal((await get(b.id)).status, 'reviewed'); assert.ok((await get(b.id)).rows.every(r => r.thesis_id === null))
    await db.exec('drop trigger test_fail_import on public.theses; drop function private.test_fail_import()')
    const result = await commit(b.id); assert.equal(result.imported, 2); assert.deepEqual(await commit(b.id), result)
  })
  await t.test('server revalidation catches changed data and newly committed duplicates; revocation applies immediately', async () => {
    const a = await stage([row('Race fixture title', '30')]), b = await stage([row('Race fixture title', '30')])
    await review(a.id, [1]); await review(b.id, [1]); await commit(a.id)
    await assert.rejects(() => commit(b.id), { code: '40001' })
    const refreshed = await get(b.id)
    assert.equal(refreshed.status, 'staged')
    assert.ok(refreshed.rows[0].duplicates.some(d => d.kind === 'existing_id'))
    assert.equal(refreshed.rows[0].decision, 'skip')
    const c = await stage([row('Tampered staging fixture', '31')]); await review(c.id, [1])
    await db.query("update private.import_rows set normalized_payload=jsonb_set(normalized_payload,'{academic_year}','\"2001-2003\"') where batch_id=$1", [c.id])
    await assert.rejects(() => commit(c.id), { code: '22023' })
    await db.query('update private.administrators set active=false where user_id=$1', [admin])
    await assert.rejects(() => stage([row('Disabled fixture')]), { code: '42501' })
    await assert.rejects(() => get(c.id), { code: '42501' }); await assert.rejects(() => commit(c.id), { code: '42501' })
    await db.query('update private.administrators set active=true where user_id=$1', [admin])
  })
  await t.test('public RPCs expose published projections only, including to administrators; count/filter/page are stable', async () => {
    for (const [user, role] of [[null, 'anon'], [ordinary, 'authenticated'], [admin, 'authenticated']]) {
      assert.equal(await as('select public.public_record($1) doc', [importedId], user, role), null)
      assert.equal((await as('select public.search_records() doc', [], user, role)).total, 0)
      await assert.rejects(() => as('select * from private.import_rows', [], user, role), { code: '42501' })
      await assert.rejects(() => as('select created_by,updated_by from public.theses', [], user, role), { code: '42501' })
    }
    await as("select public.set_record_status($1,'published',1) doc", [importedId])
    const doc = await as('select public.public_record($1) doc', [importedId], null, 'anon')
    assert.equal(doc.authors[0], 'First fixture author'); assert.equal(doc.advisers[1], 'Second fixture adviser')
    assert.ok(!('created_by' in doc)); assert.ok(!('student_number' in doc)); assert.ok(!('version' in doc))
    assert.equal((await as("select public.search_records(q=>'Second fixture adviser',year_from=>2000,year_to=>2000) doc", [], null, 'anon')).total, 1)
    assert.equal((await as('select public.search_records(year_from=>2001) doc', [], null, 'anon')).total, 0)
    const batch = await stage(Array.from({ length: 26 }, (_, n) => row(`Pagination fixture ${String(n).padStart(2, '0')}`, String(100 + n))))
    await review(batch.id, batch.rows.map(r => r.row_number)); const complete = await commit(batch.id)
    for (const r of complete.rows) await as("select public.set_record_status($1,'published',1) doc", [r.thesis_id])
    const p1 = await as("select public.search_records(q=>'Pagination',sort=>'title') doc", [], null, 'anon')
    const p2 = await as("select public.search_records(q=>'Pagination',sort=>'title',page=>2) doc", [], null, 'anon')
    assert.equal(p1.total, 26); assert.equal(p1.items.length, 24); assert.equal(p2.items.length, 2)
    assert.equal(new Set([...p1.items, ...p2.items].map(r => r.id)).size, 26)
    await assert.rejects(() => as('select public.search_records(page=>0) doc', [], null, 'anon'), { code: '22023' })
    await as("select public.set_record_status($1,'archived',2) doc", [importedId])
    assert.equal(await as('select public.public_record($1) doc', [importedId], null, 'anon'), null)
  })
  await t.test('trusted retention erases staged payloads while preserving completed summaries and retry identity', async () => {
    await assert.rejects(() => as('select private.cleanup_imports() doc'), { code: '42501' })
    await db.query("update private.import_batches set created_at=now()-interval '31 days' where id=$1", [first.id])
    await db.exec('select private.cleanup_imports()')
    const summary = await commit(first.id)
    assert.equal(summary.imported, 1); assert.equal(summary.rows[0].thesis_id, importedId); assert.equal(summary.rows[0].payload, null)
    assert.deepEqual((await db.query('select raw_payload from private.import_rows where batch_id=$1', [first.id])).rows.map(r => r.raw_payload), [{}, {}, {}])
  })
  await t.test('the 200-row limit is enforced and a bounded batch can stage and commit', async () => {
    await assert.rejects(() => stage(Array.from({ length: 201 }, (_, n) => row(`Limit fixture ${n}`))), { code: '22023' })
    const started = performance.now()
    const inputs = Array.from({ length: 200 }, (_, n) => row(`Isolated load ${crypto.randomUUID()}`, String(1000 + n)))
    const b = await stage(inputs)
    const staged = performance.now()
    await review(b.id, b.rows.map(r => r.row_number))
    const reviewed = performance.now()
    const result = await commit(b.id)
    assert.equal(result.imported, 200)
    t.diagnostic(`200-row stage/review/commit in disposable PGlite: ${Math.round(performance.now() - started)} ms (stage ${Math.round(staged-started)}, review ${Math.round(reviewed-staged)}, commit ${Math.round(performance.now()-reviewed)}); not a hosted performance guarantee.`)
  })
})
