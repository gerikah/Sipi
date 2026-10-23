import { useEffect, useId, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dialog, Icon, Logo } from './Shared'
import { loadOptions, rpc, type Choice } from '../lib/records'

export function SearchForm({ home = false, admin = false }: { home?: boolean; admin?: boolean }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const id = useId()
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const query = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    const next = new URLSearchParams(home ? '' : params)
    if (query) next.set('q', query); else next.delete('q')
    next.delete('page')
    navigate({ pathname: admin ? '/admin/records' : '/records', search: next.toString() })
  }
  return <form className="search-form" onSubmit={submit} role="search">
    <label htmlFor={id} className={admin ? undefined : 'sr-only'}>{admin ? 'Search records' : 'Search thesis records'}</label>
    <div className="search-control"><Icon name="search" /><input key={params.get('q') ?? ''} id={id} name="q" type="search" maxLength={200} defaultValue={params.get('q') ?? ''} placeholder="Search by title, author, or keyword" /><button type="submit">Search</button></div>
  </form>
}

function Filters({ onClose, admin }: { onClose: () => void; admin: boolean }) {
  const [params, setParams] = useSearchParams()
  const [error, setError] = useState('')
  const [topics, setTopics] = useState<Choice[]>([])
  useEffect(() => {
    let active = true
    void (admin ? loadOptions().then(options => options.topics) : rpc<Choice[]>('public_topics')).then(choices => { if (active) setTopics(choices) }).catch(() => { if (active) setError('Topics could not be loaded. You can still filter by academic year.') })
    return () => { active = false }
  }, [admin])
  return <Dialog title="Filter records" onClose={onClose}><form className="stack" onSubmit={(e) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const from = String(data.get('year_from') ?? '')
    const to = String(data.get('year_to') ?? '')
    if ((from && !/^\d{4}$/.test(from)) || (to && !/^\d{4}$/.test(to))) { setError('Enter a four-digit academic-year start.'); return }
    if ([from,to].some(value => value && (Number(value)<1900 || Number(value)>2199))) { setError('Use a starting year between 1900 and 2199.'); return }
    if (from && to && Number(from) > Number(to)) { setError('The start year must be before or equal to the end year.'); return }
    const next = new URLSearchParams(params)
    for (const [key, value] of [['year_from', from], ['year_to', to]]) { if (value) next.set(key, value); else next.delete(key) }
    { const topic = String(data.get('topic_id') || ''); if (topic) next.set('topic_id', topic); else next.delete('topic_id') }
    next.delete('page'); setParams(next); onClose()
  }}>
    <p>Filter by the starting year of each academic year. Compendium coverage is separate.</p>
    <div className="field-pair"><label>From year<input name="year_from" inputMode="numeric" maxLength={4} placeholder="YYYY" defaultValue={params.get('year_from') ?? ''} /></label><label>To year<input name="year_to" inputMode="numeric" maxLength={4} placeholder="YYYY" defaultValue={params.get('year_to') ?? ''} /></label></div>
    <label>Topic<select name="topic_id" disabled={!topics.length} defaultValue={params.get('topic_id') || ''}><option value="">{topics.length ? 'Any topic' : 'No topics available yet'}</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions"><button type="submit" className="primary">Apply filters</button><button type="button" onClick={onClose}>Cancel</button></div>
  </form></Dialog>
}

export function SearchToolbar({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState(false)
  const active = params.has('year_from') || params.has('year_to') || params.has('topic_id')
  const sort = ['newest', 'oldest', 'title'].includes(params.get('sort') ?? '') ? params.get('sort')! : 'newest'
  return <><div className={`search-toolbar${admin ? ' admin-search' : ''}`}>
    {!admin && <Logo />}<SearchForm admin={admin} />
    <button className="filter-button" onClick={() => setFilters(true)}><Icon name="filter" />Filter{active ? ' · Applied' : ''}</button>
    <label className="sort-control"><span className="sr-only">Sort records</span><select aria-label="Sort records" value={sort} onChange={(e) => { const next = new URLSearchParams(params); next.set('sort', e.target.value); next.delete('page'); setParams(next) }}><option value="newest">Newest year</option><option value="oldest">Oldest year</option><option value="title">Title A to Z</option></select></label>
  </div>
  {active && <div className="filter-summary"><span>Academic year: {params.get('year_from') || 'Any'} to {params.get('year_to') || 'Any'}</span><button onClick={() => { const next = new URLSearchParams(params); ['year_from', 'year_to', 'topic_id', 'page'].forEach((key) => next.delete(key)); setParams(next) }}>Clear filters</button></div>}
  {filters && <Filters onClose={() => setFilters(false)} admin={admin} />}
  </>
}
