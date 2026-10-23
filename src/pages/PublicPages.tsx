import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState, ImageArea, Logo, SourceNote } from '../components/Shared'
import { SearchForm, SearchToolbar } from '../components/SearchToolbar'
import { usePublicQuery, usePublicSearch, type PublicRecord, type SearchResult } from '../lib/discovery'

export function usePageTitle(title: string) {
  useEffect(() => { document.title = `${title} · Sipi` }, [title])
}

export function Home() {
  usePageTitle('Thesis records, easier to find')
  return <><section className="home-hero"><Logo large /><SearchForm home /></section>
    <section className="home-intro"><div className="stack"><h1>Thesis records,<br />easier to find.</h1><p className="intro-description">Browse thesis records from the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila.</p><div className="source-note"><SourceNote /></div></div><ImageArea src="/images/Filing theses beside an archive laptop.png" alt="Illustration of a hand filing a thesis beside a laptop and books." /></section>
    <AboutSection />
  </>
}

function AboutSection() {
  return <section id="about" className="about-section" aria-labelledby="about-title" tabIndex={-1}><div className="about-images">
    <ImageArea src="/images/Hands holding an open book.png" alt="Illustration of hands holding an open book." />
    <ImageArea src="/images/Hands Examining Research.png" alt="Illustration of hands examining research with a magnifying glass and pencil." />
    <ImageArea src="/images/Hands Exploring a Research Compendium.png" alt="Illustration of hands exploring a research compendium beside a laptop." />
  </div>
    <div className="about-copy stack"><h2 id="about-title">About Sipi</h2><p>Sipi helps students and faculty find thesis records from the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila.</p><SourceNote /><p className="source-note">This version provides thesis record details. Full thesis documents are not available here.</p></div>
  </section>
}


export function RecordCard({ record }: { record: PublicRecord }) {
  const { search } = useLocation()
  return <article className="record-card"><h2><Link to={`/records/${record.id}${search}`}>{record.title}</Link></h2>
    <div className="record-metadata"><p>{record.authors.join(', ')}</p><p>{record.academicYear}</p></div>
    {record.abstract?.trim() && <><h3>Abstract</h3><p className="abstract-preview">{record.abstract}</p></>}
    <Link to={`/records/${record.id}${search}`}>View record</Link>
  </article>
}
function ResultPagination({ data }: { data?: SearchResult }) {
  const [params, setParams] = useSearchParams()
  function go(page: number) { const next = new URLSearchParams(params); next.set('page', String(page)); setParams(next) }
  return <nav className="pagination" aria-label="Pagination"><button disabled={!data || data.page <= 1} onClick={() => go(data!.page - 1)}>Previous</button><span>{data?.total ? `Page ${data.page} · ${data.total} records` : 'No pages to show'}</span><button disabled={!data || data.page * 24 >= data.total} onClick={() => go(data!.page + 1)}>Next</button></nav>
}
function QueryError({ retry }: { retry: () => void }) { return <div className="notice"><p role="alert">We could not load the records. Try again.</p><button onClick={retry}>Try again</button></div> }
export function SearchResults() {
  usePageTitle('Search records')
  const { data, error, retry } = usePublicSearch()
  const { search } = useLocation()
  return <section className="page"><SearchToolbar /><h1>Search records</h1>
    {error ? <QueryError retry={retry} /> : !data ? <p role="status">Loading records…</p> : <div className="record-grid">{data.items.length ? data.items.map(record => <RecordCard key={record.id} record={record} />) : <EmptyState title={search ? 'No matching records found.' : 'No thesis records are available yet.'}><p>{search ? 'Try another search or change the filters.' : 'Published thesis records will appear here when they are available.'}</p></EmptyState>}</div>}
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
  const shareUrl = new URL(`/records/${id}`, location.origin).href
  usePageTitle(record?.title || (record === null ? 'Record not found' : 'Thesis record'))
  return <section className="page"><SearchToolbar /><Link className="back-link" to={`/records${search}`}>{search ? 'Back to results' : 'Back to all records'}</Link>
    <div className="record-split"><aside className="supporting-results" aria-label="Current search results" tabIndex={0}><h2>Search results</h2>{results.error ? <QueryError retry={results.retry} /> : !results.data ? <p role="status">Loading results…</p> : results.data.items.length ? results.data.items.map(item => <article className={`record-card${item.id === id ? " selected-record" : ""}`} key={item.id}><h3><Link aria-current={item.id === id ? 'page' : undefined} to={`/records/${item.id}${search}`}>{item.title}</Link></h3><p>{item.authors.join(', ')}</p><p>{item.academicYear}</p></article>) : <p>No matching records found.</p>}</aside>
      <section className="record-detail">{error ? <QueryError retry={retry} /> : record === undefined ? <p role="status">Loading record…</p> : !record ? <><h1>Record not found.</h1><p>This record is not available in the public repository.</p><Link className="button" to={`/records${search}`}>Search records</Link></> : <>
        <h1>{record.title}</h1><button onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setCopied('Link copied.') } catch { setCopied('Copy the link from the field below.') } }}>Copy record link</button>{copied && <p role="status">{copied}</p>}{copied.startsWith('Copy') && <label>Record link<input readOnly value={shareUrl} onFocus={e => e.target.select()} /></label>}
        <div className="record-body">
          {record.abstract?.trim() && <section className="detail-abstract stack"><h2>Abstract</h2><p className="abstract-text">{record.abstract}</p></section>}
          <aside className="detail-metadata"><h2>Record details</h2><dl className="public-details"><dt>Authors</dt><dd>{record.authors.join(', ')}</dd><dt>Academic year</dt><dd>{record.academicYear}</dd>{record.advisers.length > 0 && <><dt>Main adviser</dt><dd>{record.advisers.join(', ')}</dd></>}{record.group_code?.trim() && <><dt>Group code</dt><dd>{record.group_code}</dd></>}{record.section_block?.trim() && <><dt>Section/block</dt><dd>{record.section_block}</dd></>}{record.panel_members.length > 0 && <><dt>Final panel members</dt><dd>{record.panel_members.join(', ')}</dd></>}</dl></aside>
          <section className="source-panel stack"><h2>Source</h2><p>{record.source_name}</p>{record.source_archive_id && <p>Original archive ID: {record.source_archive_id}</p>}{record.source_created_at && <p>Source timestamp: {record.source_created_at.replace('T', ' ')} (timezone not specified)</p>}</section>
        </div>
      </>}</section>
    </div>
  </section>
}

export function NotFound() {
  usePageTitle('Page not found')
  return <section className="page error-page"><Logo /><h1>Page not found.</h1><p>The page you are looking for is not available.</p><Link className="button" to="/">Back to repository</Link></section>
}
