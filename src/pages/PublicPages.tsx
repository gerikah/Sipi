import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState, Icon, ImageArea, Logo, SourceNote } from '../components/Shared'
import { SearchForm, SearchToolbar } from '../components/SearchToolbar'
import { RecordTerms } from '../components/RecordTerms'
import { abstractParagraphs } from '../lib/abstract'
import { usePublicQuery, usePublicSearch, type PublicRecord, type SearchResult } from '../lib/discovery'

export function usePageTitle(title: string) {
  useEffect(() => { document.title = `${title} · Sipi` }, [title])
}

export function Home() {
  usePageTitle('Thesis records, easier to find')
  return <><section className="home-hero"><Logo large /><SearchForm home /></section>
    <section className="home-intro"><div className="stack"><h1>Thesis records,<br />easier to find.</h1><p className="intro-description">Explore published research by title, author, adviser, or academic year.</p></div><ImageArea src="/images/Filing theses beside an archive laptop.png" alt="Illustration of a hand filing a thesis beside a laptop and books." /></section>
    <AboutSection />
  </>
}

function AboutSection() {
  return <section id="about" className="about-section" aria-labelledby="about-title" tabIndex={-1}>
    <div className="about-copy stack"><h2 id="about-title">About Sipi</h2><SourceNote /><p className="field-note">Browse record details and abstracts here. Full thesis documents are not available.</p></div>
    <div className="about-images">
    <ImageArea src="/images/Hands holding an open book.png" alt="Illustration of hands holding an open book." />
    <ImageArea src="/images/Hands Examining Research.png" alt="Illustration of hands examining research with a magnifying glass and pencil." />
    <ImageArea src="/images/Hands Exploring a Research Compendium.png" alt="Illustration of hands exploring a research compendium beside a laptop." />
  </div>
  </section>
}


export function RecordCard({ record }: { record: PublicRecord }) {
  const { search } = useLocation()
  const author = record.authors[0] ? `${record.authors[0]}${record.authors.length > 1 ? ', et al.' : ''}` : ''
  return <article className="record-card result-card"><h2><Link title={record.title} to={`/records/${record.id}${search}`}>{record.title}</Link></h2>
    <p className="card-author" title={author}>{author}</p>
    <p className="card-year">{record.academicYear}</p>
    {record.advisers.length > 0 && <div className="card-adviser"><span>Adviser: </span><People names={record.advisers} /></div>}
    <p className="abstract-preview">{record.abstract?.trim() ? record.abstract : ''}</p>
    <RecordTerms record={record} compact />
  </article>
}
function People({ names }: { names: string[] }) {
  return <ul className="public-people" role="list">{names.map((name, index) => <li key={index}>{name}</li>)}</ul>
}
function ResultPagination({ data }: { data?: SearchResult }) {
  const [params, setParams] = useSearchParams()
  function go(page: number) { const next = new URLSearchParams(params); next.set('page', String(page)); setParams(next) }
  return <nav className="pagination" aria-label="Pagination"><button disabled={!data || data.page <= 1} onClick={() => go(data!.page - 1)}>Previous</button><span>{data?.total ? `Page ${data.page} · ${data.total} records` : 'No pages to show'}</span><button disabled={!data || data.page * 24 >= data.total} onClick={() => go(data!.page + 1)}>Next</button></nav>
}
function QueryError({ retry, message = 'We could not load the records. Try again.' }: { retry: () => void; message?: string }) { return <div className="notice"><p role="alert">{message}</p><button onClick={retry}>Try again</button></div> }
export function SearchResults() {
  usePageTitle('Search records')
  const { data, error, retry } = usePublicSearch()
  const { search } = useLocation()
  return <section className="page"><SearchToolbar /><h1 className="sr-only">Search records</h1>
    {error ? <QueryError retry={retry} message={error} /> : !data ? <p role="status">Loading records…</p> : <div className="record-grid">{data.items.length ? data.items.map(record => <RecordCard key={record.id} record={record} />) : <EmptyState title={search ? 'No matching records found.' : 'No thesis records are available yet.'}><p>{search ? 'Try another search or change the filters.' : 'Published thesis records will appear here when they are available.'}</p></EmptyState>}</div>}
    <ResultPagination data={data} />
  </section>
}
export function ViewRecord() {
  const { id } = useParams()
  const { search } = useLocation()
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')
  const { data: record, error, retry } = usePublicQuery<PublicRecord | null>('public_record', { record_id: validId ? id : null })
  const results = usePublicSearch()
  const [copied, setCopied] = useState('')
  const [mobilePanel, setMobilePanel] = useState<'results' | 'details'>('details')
  const shareUrl = new URL(`/records/${id}`, location.origin).href
  usePageTitle(record?.title || (record === null ? 'Record not found' : 'Thesis record'))
  return <section className={`page record-view-page show-${mobilePanel}`}>
    <div className="record-view-actions"><Link className="back-link" to={`/records${search}`}><Icon name="arrow" />Back to results</Link>
      {record && <button onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setCopied('Link copied.') } catch { setCopied('Copy the link from the field below.') } }}>Copy record link</button>}
    </div>
    {copied && <p role="status">{copied}</p>}{copied.startsWith('Copy') && <label>Record link<input readOnly value={shareUrl} onFocus={event => event.target.select()} /></label>}
    <div className="record-view-switch" role="group" aria-label="Record view"><button aria-pressed={mobilePanel === 'results'} onClick={() => setMobilePanel('results')}>Results</button><button aria-pressed={mobilePanel === 'details'} onClick={() => setMobilePanel('details')}>Thesis</button></div>
    <div className="record-split"><aside className="supporting-results" aria-label="Current search results" tabIndex={0}><h2>Search results</h2>{results.error ? <QueryError retry={results.retry} message={results.error} /> : !results.data ? <p role="status">Loading results…</p> : results.data.items.length ? results.data.items.map(item => <article className={`record-card${item.id === id ? " selected-record" : ""}`} key={item.id}><h3><Link aria-current={item.id === id ? 'page' : undefined} onClick={() => { setMobilePanel('details'); setCopied('') }} to={`/records/${item.id}${search}`}>{item.title}</Link></h3><People names={item.authors} /><p>{item.academicYear}</p></article>) : <p>No matching records found.</p>}</aside>
      <section key={id} className="record-detail" tabIndex={0} aria-label="Thesis details">{error ? <QueryError retry={retry} /> : record === undefined ? <p role="status">Loading record…</p> : !record ? <><h1>Record not found.</h1><p>This record is not available in the public repository.</p><Link className="button" to={`/records${search}`}>Search records</Link></> : <>
        <h1>{record.title}</h1>
        <div className="record-body">
          {record.abstract?.trim() && <section className="detail-abstract stack"><h2>Abstract</h2><div className="abstract-text">{abstractParagraphs(record.abstract).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></section>}
          <aside className="detail-metadata"><h2>Record details</h2><dl className="public-details"><dt>Authors</dt><dd><People names={record.authors} /></dd><dt>Academic year</dt><dd>{record.academicYear}</dd>{record.advisers.length > 0 && <><dt>Adviser</dt><dd><People names={record.advisers} /></dd></>}{record.group_code?.trim() && <><dt>Group code</dt><dd>{record.group_code}</dd></>}{record.section_block?.trim() && <><dt>Section/block</dt><dd>{record.section_block}</dd></>}{record.panel_members.length > 0 && <><dt>Final panel members</dt><dd><People names={record.panel_members} /></dd></>}</dl></aside>
          <section className="source-panel"><h2>Source</h2><p>{record.source_name}</p><dl className="source-details">{record.source_archive_id && <div><dt>Original archive ID</dt><dd>{record.source_archive_id}</dd></div>}{record.source_created_at && <div><dt>Source timestamp</dt><dd>{record.source_created_at.replace('T', ' ')}<span className="source-timezone">Timezone not specified</span></dd></div>}</dl></section>
          <RecordTerms record={record} />
        </div>
      </>}</section>
    </div>
  </section>
}

export function NotFound() {
  usePageTitle('Page not found')
  return <section className="page error-page"><Logo /><h1>Page not found.</h1><p>The page you are looking for is not available.</p><Link className="button" to="/">Back to repository</Link></section>
}
