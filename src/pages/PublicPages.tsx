import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { EmptyState, ImageArea, Logo, Pagination, SourceNote } from '../components/Shared'
import { SearchForm, SearchToolbar } from '../components/SearchToolbar'

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

// The collection is intentionally empty. No fixtures are bundled into the app.
export type PublicRecord = { id: string; title: string; authors: string[]; academicYear: string; abstract: string | null; topics: string[]; keywords: string[] }
const records: PublicRecord[] = []

export function RecordCard({ record }: { record: PublicRecord }) {
  const { search } = useLocation()
  return <article className="record-card"><h2><Link to={`/records/${encodeURIComponent(record.id)}${search}`}>{record.title}</Link></h2>
    <div className="record-metadata"><p>{record.authors.join(', ')}</p><p>{record.academicYear}</p></div>
    <h3>Abstract</h3><p>{record.abstract || 'No abstract available.'}</p>
    {!!(record.topics.length + record.keywords.length) && <ul className="chips">{[...record.topics, ...record.keywords].map((tag, i) => <li key={`${tag}-${i}`}>{tag}</li>)}</ul>}
    <Link to={`/records/${encodeURIComponent(record.id)}${search}`}>View record</Link>
  </article>
}

export function SearchResults() {
  usePageTitle('Search records')
  return <section className="page"><SearchToolbar /><h1>Search records</h1>
    <div className="record-grid">{records.length ? records.map((record) => <RecordCard key={record.id} record={record} />) : <EmptyState title="No thesis records are available yet."><p>Published thesis records will appear here when they are available.</p></EmptyState>}</div>
    <Pagination />
  </section>
}

export function ViewRecord() {
  usePageTitle('Record not found')
  const { search } = useLocation()
  return <section className="page"><SearchToolbar /><Link className="back-link" to={`/records${search}`}>{search ? 'Back to results' : 'Back to all records'}</Link>
    <div className="record-split"><aside className="supporting-results"><h2>Search results</h2><p>No thesis records are available yet.</p></aside>
      <section className="record-detail"><h1>Record not found.</h1><p>This record is not available in the public repository.</p><Link className="button" to={`/records${search}`}>Search records</Link></section>
    </div>
  </section>
}

export function NotFound() {
  usePageTitle('Page not found')
  return <section className="page error-page"><Logo /><h1>Page not found.</h1><p>The page you are looking for is not available.</p><Link className="button" to="/">Back to repository</Link></section>
}
