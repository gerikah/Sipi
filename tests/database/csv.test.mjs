import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, mapRows, proposedMapping, validateImport, MAX_CSV_BYTES } from '../../src/lib/csv.ts'

test('CSV quoting, BOM, line endings, escaped quotes and blank values preserve cells', () => {
  const csv = parseCsv('\uFEFFthesis_title,batch_year,author_name,abstract\r\n"Quoted, title",2000-2001,"Family, Given","Line one\r\nLine ""two"""\r\n')
  assert.equal(csv.rows.length, 1); assert.equal(csv.rows[0][0], 'Quoted, title'); assert.equal(csv.rows[0][3], 'Line one\r\nLine "two"')
  const rows = mapRows(csv, proposedMapping(csv.headers), { authors: 'single', advisers: 'review', panel_members: 'review' })
  assert.deepEqual(rows[0].payload.authors, ['Family, Given']); assert.deepEqual(validateImport(rows[0]), [])
  assert.deepEqual(parseCsv('a,b\rx,\ry,z').rows, [['x', ''], ['y', 'z']])
})
test('CSV rejects malformed structure and bounds, and flags field errors without discarding original cells', () => {
  for (const text of ['a,a\n1,2', ',b\n1,2', 'a\n"unclosed', 'a\n"closed"garbage', 'a\nun"quoted', 'a']) assert.throws(() => parseCsv(text))
  assert.throws(() => parseCsv('a\n' + 'x'.repeat(MAX_CSV_BYTES)))
  assert.throws(() => parseCsv('a\n' + Array.from({ length: 201 }, () => 'x').join('\n')))
  const csv = parseCsv('thesis_title,batch_year,author_name,archive_id,created_at,student_number\nFixture,2000-2002,"One; Two",9223372036854775808,2026-02-30 12:00:00,PRIVATE\nShort row,2000-2001')
  const rows = mapRows(csv, proposedMapping(csv.headers), { authors: 'semicolon', advisers: 'single', panel_members: 'single' })
  assert.deepEqual(rows[0].payload.authors, ['One', 'Two'])
  assert.equal(validateImport(rows[0]).length, 4); assert.match(validateImport(rows[1]).join(), /expected 6 cells/)
  assert.equal(rows[0].raw.student_number, 'PRIVATE')
})
test('unverified name delimiters require row review; missing markers stay empty and identifiers stay strings', () => {
  const csv = parseCsv('thesis_title,batch_year,author_name,main_adviser,archive_id,group_code\nFixture,2000–2001,"One, Two",No record,9223372036854775807,001')
  const mapping = proposedMapping(csv.headers)
  const [review] = mapRows(csv, mapping, { authors: 'review', advisers: 'single', panel_members: 'single' })
  assert.deepEqual(review.payload.authors, []); assert.match(validateImport(review).join(), /authors/)
  const [row] = mapRows(csv, mapping, { authors: 'comma', advisers: 'single', panel_members: 'single' })
  assert.deepEqual(row.payload.authors, ['One', 'Two']); assert.deepEqual(row.payload.advisers, [])
  assert.equal(row.payload.group_code, '001'); assert.equal(row.payload.source_archive_id, '9223372036854775807'); assert.deepEqual(validateImport(row), [])
})
