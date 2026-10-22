import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// A disposable PostgreSQL engine, not a live Supabase project. Auth identities
// are test-only claims; actual Auth/PostgREST integration needs the full stack.
test('migrations, role permissions, lifecycle and transaction integrity', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant all on sequences to anon,authenticated;
    alter default privileges in schema public grant execute on functions to anon,authenticated;`)
  for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'))
  }
  const admin = '00000000-0000-4000-8000-000000000001'
  const ordinary = '00000000-0000-4000-8000-000000000002'
  const disabled = '00000000-0000-4000-8000-000000000003'
  const source = '00000000-0000-4000-8000-000000000011'
  const year = '00000000-0000-4000-8000-000000000012'
  const topic = '00000000-0000-4000-8000-000000000013'
  const keyword = '00000000-0000-4000-8000-000000000014'
  await db.exec(`insert into auth.users values('${admin}'),('${ordinary}'),('${disabled}');
    insert into private.administrators(user_id,active) values('${admin}',true),('${disabled}',false);
    insert into public.sources(id,name) values('${source}','Isolated test source');
    insert into public.academic_years(id,start_year,end_year) values('${year}',2000,2001);
    insert into public.topics(id,name) values('${topic}','Isolated topic');
    insert into public.keywords(id,name) values('${keyword}','Isolated keyword');`)
  async function as(role, user, sql, params = []) {
    await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${user ?? ''}',false);`)
    try { return await db.query(sql, params) } finally { await db.exec('reset role') }
  }
  const save = (payload, version = null, user = admin) => as('authenticated', user, 'select public.save_record($1::jsonb,$2::integer) as record', [JSON.stringify(payload),version]).then(r => r.rows[0].record)
  const status = (id, value, version, user = admin) => as('authenticated', user, 'select public.set_record_status($1::uuid,$2::text,$3::integer) as record', [id,value,version]).then(r => r.rows[0].record)
  const denied = async (fn, code) => assert.rejects(fn, error => error.code === code)
  let draft, published, authors
  await t.test('no migration seeds; unapproved and disabled users cannot write or self-assign', async () => {
    assert.equal((await db.query('select count(*)::int as n from public.theses')).rows[0].n,0)
    for (const [role,user] of [['anon',null],['authenticated',ordinary],['authenticated',disabled],['authenticated',admin]]) {
      await denied(() => as(role,user,"insert into public.theses(title) values('Bypass')"),'42501')
      await denied(() => as(role,user,`insert into private.administrators(user_id) values('${ordinary}')`),'42501')
      for (const table of ['administrators','author_identifiers','import_batches','import_rows','audit_logs']) await denied(() => as(role,user,`select * from private.${table}`),'42501')
    }
    await denied(() => as('anon',null,"select public.save_record('{}',null)"),'42501')
    await denied(() => as('anon',null,'select public.is_admin()'),'42501')
    await denied(() => as('authenticated',admin,'select private.require_admin()'),'42501')
    for (const user of [ordinary,disabled]) {
      assert.equal((await as('authenticated',user,'select public.is_admin() as allowed')).rows[0].allowed,false)
      await denied(() => save({},null,user),'42501')
      await denied(() => status(source,'published',1,user),'42501')
    }
    assert.equal((await as('authenticated',admin,'select public.is_admin() as allowed')).rows[0].allowed,true)
  })
  await t.test('atomic save preserves provenance and ordered names; authors retain private identity when reordered', async () => {
    draft = await save({title:'Isolated fixture',academic_year_id:year,source_id:source,source_archive_id:17,source_row_number:2,group_code:'001',section_block:'test',source_created_at:'2026-01-02T03:04:05',authors:[{full_name:'Fixture A'},{full_name:'Fixture B'}],advisers:[{display_name:'Faculty B'},{display_name:'Faculty A'}],panel_members:[{display_name:'Panel fixture'}],topic_ids:[topic],keyword_ids:[keyword]})
    authors = (await db.query('select * from public.thesis_authors where thesis_id=$1 order by author_order',[draft.id])).rows
    await db.query("insert into private.author_identifiers values($1,'PRIVATE-TEST-ONLY')",[authors[0].id])
    draft = await save({id:draft.id,authors:authors.toReversed().map(a => ({id:a.id,full_name:a.full_name}))},draft.version)
    assert.equal(draft.version,2)
    assert.deepEqual((await db.query('select full_name from public.thesis_authors where thesis_id=$1 order by author_order',[draft.id])).rows.map(x=>x.full_name),['Fixture B','Fixture A'])
    assert.equal((await db.query('select count(*)::int n from private.author_identifiers')).rows[0].n,1)
    const record = (await db.query('select group_code,source_archive_id,source_created_at::text,created_by,updated_by from public.theses where id=$1',[draft.id])).rows[0]
    assert.deepEqual(record,{group_code:'001',source_archive_id:17,source_created_at:'2026-01-02 03:04:05',created_by:admin,updated_by:admin})
    assert.deepEqual((await db.query('select display_name from public.thesis_advisers a join public.faculty_members f on f.id=a.faculty_id where thesis_id=$1 order by adviser_order',[draft.id])).rows.map(x=>x.display_name),['Faculty B','Faculty A'])
  })
  await t.test('draft metadata remains private; publishing exposes only associated metadata', async () => {
    const tables=['theses','thesis_authors','thesis_advisers','thesis_panel_members','faculty_members','academic_years','sources','topics','thesis_topics','keywords','thesis_keywords']
    for (const [role,user] of [['anon',null],['authenticated',ordinary],['authenticated',disabled]]) {
      for(const table of tables) assert.equal((await as(role,user,`select count(*)::int n from public.${table}`)).rows[0].n,0,table)
    }
    published=await status(draft.id,'published',draft.version)
    const hidden=await save({title:'Unpublished fixture',authors:[{full_name:'Hidden author'}],advisers:[{display_name:'Hidden faculty'}]})
    for (const [role,user] of [['anon',null],['authenticated',ordinary],['authenticated',disabled]]) {
      assert.equal((await as(role,user,'select count(*)::int n from public.theses')).rows[0].n,1)
      assert.equal((await as(role,user,'select * from public.theses where id=$1',[hidden.id])).rows.length,0)
      assert.equal((await as(role,user,'select count(*)::int n from public.thesis_authors')).rows[0].n,2)
      assert.equal((await as(role,user,'select count(*)::int n from public.faculty_members')).rows[0].n,3)
      for(const table of ['academic_years','sources','topics','keywords','thesis_topics','thesis_keywords','thesis_panel_members']) assert.equal((await as(role,user,`select count(*)::int n from public.${table}`)).rows[0].n,1,table)
    }
    assert.equal((await as('authenticated',admin,'select count(*)::int n from public.theses')).rows[0].n,2)
  })
  await t.test('publication validation, stale writes, spoofed actors and failures roll back records, relationships and audit', async () => {
    const snapshot=async()=> (await db.query(`select jsonb_build_object('theses',(select jsonb_agg(t order by id) from public.theses t),'authors',(select jsonb_agg(a order by id) from public.thesis_authors a),'faculty',(select jsonb_agg(f order by id) from public.faculty_members f),'audit',(select jsonb_agg(l order by id) from private.audit_logs l)) as value`)).rows[0].value
    const before=await snapshot()
    await denied(()=>save({id:published.id,title:'Stale'},1),'40001')
    await denied(()=>status(published.id,'archived',1),'40001')
    await denied(()=>save({id:published.id,authors:[]},published.version),'23514')
    await denied(()=>save({title:'Should roll back',advisers:[{display_name:'Rollback faculty'}],topic_ids:[source]}),'23503')
    await denied(()=>save({created_by:ordinary}),'22023')
    await denied(()=>save({status:'published'}),'22023')
    await denied(()=>save({source_id:source,source_archive_id:1.5}),'22023')
    await denied(()=>save({source_created_at:'2026-01-02T03:04:05Z'}),'22023')
    await denied(()=>save({id:published.id,authors:[{id:source,full_name:'Hijack'}]},published.version),'22023')
    await denied(()=>save({source_id:source,source_archive_id:17}),'23505')
    assert.deepEqual(await snapshot(),before)
    const incomplete=await save({})
    await denied(()=>status(incomplete.id,'published',incomplete.version),'23514')
    const noAuthor=await save({title:'Missing author',academic_year_id:year,source_id:source})
    await denied(()=>status(noAuthor.id,'published',noAuthor.version),'23514')
    assert.equal((await db.query('select count(*)::int n from private.audit_logs where actor_id<>$1',[admin])).rows[0].n,0)
  })
  await t.test('archive preserves relationships, requires restore, and revocation takes effect with the same claims', async () => {
    const archived=await status(published.id,'archived',published.version)
    assert.equal((await as('anon',null,'select * from public.theses')).rows.length,0)
    await denied(()=>status(archived.id,'published',archived.version),'22023')
    await denied(()=>save({id:archived.id,title:'Archived edit'},archived.version),'22023')
    const restored=await status(archived.id,'draft',archived.version)
    assert.equal((await db.query('select count(*)::int n from public.thesis_authors where thesis_id=$1',[restored.id])).rows[0].n,2)
    await db.query('update private.administrators set active=false where user_id=$1',[admin])
    await denied(()=>save({id:restored.id,title:'Revoked'},restored.version),'42501')
    await denied(()=>status(restored.id,'published',restored.version),'42501')
    assert.equal((await as('authenticated',admin,'select * from public.theses')).rows.length,0)
  })
  await t.test('management reads and classification writes reject unapproved/disabled users; catalog edits detect conflicts', async () => {
    await db.query('update private.administrators set active=true where user_id=$1',[admin])
    for (const [role,user] of [['anon',null],['authenticated',ordinary],['authenticated',disabled]]) {
      for (const query of ["select public.admin_records()", `select public.admin_record('${draft.id}')`, "select public.save_classification('topic','Denied')"]) await denied(() => as(role,user,query),'42501')
    }
    const detail = (await as('authenticated',admin,'select public.admin_record($1) as doc',[draft.id])).rows[0].doc
    assert.equal(detail.authors[0].full_name,'Fixture B')
    assert.equal(JSON.stringify(detail).includes('student_number'),false)
    assert.equal(JSON.stringify(detail).includes('PRIVATE-TEST-ONLY'),false)
    assert.equal((await as('authenticated',admin,"select public.admin_records(q=>'fixture b',year_from=>2000,year_to=>2000) as doc")).rows[0].doc.total,1)
    assert.equal((await as('authenticated',admin,"select public.admin_records(record_status=>'published') as doc")).rows[0].doc.total,0)
    await db.exec("insert into public.theses(title) select 'Pagination test only ' || n from generate_series(1,26) n")
    const first=(await as('authenticated',admin,"select public.admin_records(q=>'Pagination test only',sort=>'title') as doc")).rows[0].doc
    const second=(await as('authenticated',admin,"select public.admin_records(q=>'Pagination test only',sort=>'title',page=>2) as doc")).rows[0].doc
    assert.equal(first.total,26); assert.equal(first.items.length,24); assert.equal(second.items.length,2)
    assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,26)
    await denied(()=>as('authenticated',admin,'select public.admin_records(page=>0)'),'22023')
    const created=(await as('authenticated',admin,"select public.save_classification('topic','Unique test topic') as id")).rows[0].id
    await as('authenticated',admin,"select public.save_classification('topic','Renamed test topic',$1,'Unique test topic')",[created])
    await denied(()=>as('authenticated',admin,"select public.save_classification('topic','Overwrite',$1,'Unique test topic')",[created]),'40001')
    await denied(()=>as('authenticated',admin,"select public.save_classification('academic_year','2001-2003')"),'22023')
    await denied(()=>as('authenticated',admin,"select public.save_classification('source','Invented source')"),'22023')
    const large = await save({source_id:source,source_archive_id:'9223372036854775807'})
    const largeDoc=(await as('authenticated',admin,'select public.admin_record($1) as doc',[large.id])).rows[0].doc
    assert.equal(largeDoc.source_archive_id,'9223372036854775807')
    assert.equal(typeof largeDoc.repository_code,'string')
    await denied(()=>save({source_id:source,source_archive_id:'9223372036854775808'}),'22003')
    await db.query('update private.administrators set active=false where user_id=$1',[admin])
    await denied(()=>as('authenticated',admin,'select public.admin_records()'),'42501')
  })
})
