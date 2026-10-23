import { useEffect, useState } from 'react'
import { loadPublicCatalog } from '../lib/public-catalog'
import { termOptions } from '../lib/terms'

export function TermFilters({ params }: { params: URLSearchParams }) {
  const [options, setOptions] = useState<ReturnType<typeof termOptions> | null>(null)
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  const query = params.get('q') || '', from = params.get('year_from'), to = params.get('year_to')
  useEffect(() => {
    let active = true
    void loadPublicCatalog({ q: query, year_from: from ? Number(from) : null, year_to: to ? Number(to) : null, topic_id: null, sort: 'title' }, () => !active)
      .then(records => { if (active && records) { setOptions(termOptions(records)); setError('') } })
      .catch(cause => { if (active) setError(cause instanceof Error && !('code' in cause) ? cause.message : 'We could not load keyword and technology choices. Try again.') })
    return () => { active = false }
  }, [query, from, to, attempt])
  return <div className="stack">
    <label>Hardware or software<select name="category" defaultValue={params.get('category') || ''}><option value="">Any</option><option value="hardware">Hardware (including combined projects)</option><option value="software">Software (including combined projects)</option><option value="both">Hardware + Software</option><option value="unclassified">Not classified</option></select></label>
    <p className="field-note">Hardware/software grouping is automatic, based on component names in the title and abstract. It may need administrator review.</p>
    <p>Keywords and index terms come from labeled lists in the abstract. Technologies are names mentioned in the title or abstract, not a verified complete tech stack. Selecting both requires both to match.</p>
    {!options && !error && <p role="status">Reading terms from published records…</p>}
    {error && <div className="stack"><p role="alert" className="error">{error}</p><button type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Reload terms</button></div>}
    {(['keyword', 'technology'] as const).map(kind => <label key={kind}>{kind === 'keyword' ? 'Keyword or index term' : 'Mentioned technology'}<select name={kind} defaultValue={params.get(kind) || ''} disabled={!options}>
      <option value="">Any</option>
      {params.get(kind) && !options?.some(option => option.key === params.get(kind)) && <option value={params.get(kind)!}>{params.get(kind)!.split(':').slice(1).join(':')} (current filter)</option>}
      {options?.filter(option => option.kind === kind).map(option => <option key={option.key} value={option.key}>{option.label} ({option.count})</option>)}
    </select></label>)}
    {options && <p className="field-note">Choices and counts reflect published records matching the current search and applied academic years.{!options.length && ' No explicit terms were found.'}</p>}
  </div>
}
