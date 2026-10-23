import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceTerms, recordCategory, matchesCategory, matchesTerms, termOptions } from '../../src/lib/terms.ts'

test('discovery terms use explicit source lists and named technologies without changing source text', () => {
  const record = { title: 'Isolated Arduino study', abstract: 'Original text.\nKeywords: Water quality; Remote sensing; Water quality.' }
  const before = structuredClone(record)
  assert.deepEqual(sourceTerms(record).map(t => t.label), ['Water quality', 'Remote sensing', 'Arduino'])
  assert.deepEqual(record, before)
  assert.deepEqual(sourceTerms({ title: 'Isolated study', abstract: 'A useful approach to water quality.' }), [])
  assert.equal(termOptions([record, record]).find(t => t.label === 'Arduino').count, 2)
})

test('PHP currency values do not become software evidence or technology tags', () => {
  for (const abstract of ['Costs PHP 1,200.', 'Budget 2000 PHP.']) {
    assert.deepEqual(sourceTerms({ title: '', abstract }), [])
    assert.equal(recordCategory({ title: '', abstract }).key, 'unclassified')
  }
  assert.equal(sourceTerms({ title: 'PHP website', abstract: null })[0].label, 'PHP')
})

test('automatic groups show source evidence and combined projects match both filters', () => {
  const record = { title: 'Arduino sensors with Android application', abstract: null }
  const category = recordCategory(record)
  assert.equal(category.key, 'both')
  assert.deepEqual(category.hardware, ['arduino', 'sensors'])
  assert.deepEqual(category.software, ['android application'])
  assert.ok(matchesCategory(record, 'hardware')); assert.ok(matchesCategory(record, 'software'))
  assert.equal(recordCategory({ title: 'Mobile device application with machine learning', abstract: null }).key, 'software')
})

test('term filters require every selected facet and distinguish source keywords from technologies', () => {
  const record = { title: 'Arduino', abstract: 'Index Terms — Remote sensing, Water quality.' }
  assert.ok(matchesTerms(record, 'keyword:remote sensing', 'technology:arduino'))
  assert.equal(matchesTerms(record, 'keyword:absent', 'technology:arduino'), false)
  assert.equal(matchesTerms(record, 'technology:remote sensing', ''), false)
})
