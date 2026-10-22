import { useEffect, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { Dialog, PhaseNotice } from '../components/Shared'
import { usePageTitle } from './PublicPages'

type PersonInput = { key: string; name: string }

function PeopleFields({ label, required = false, disabled, people, onChange }: { label: string; required?: boolean; disabled: boolean; people: PersonInput[]; onChange: (people: PersonInput[]) => void }) {
  const singular = label === 'Authors' ? 'author' : 'adviser'
  return <fieldset className="people-fields" disabled={disabled}><legend>{label}{required ? ' *' : ' (optional)'}</legend>
    {people.map((person, index) => <div className="person-row" key={person.key}><label className="person-input"><span className="sr-only">{singular} {index + 1}</span><input autoComplete="off" value={person.name} placeholder={`Enter ${singular} name`} onChange={(e) => onChange(people.map((p) => p.key === person.key ? { ...p, name: e.target.value } : p))} /></label>
      <div className="person-actions"><button type="button" aria-label={`Move ${singular} ${index + 1} up`} disabled={index === 0} onClick={() => { const next = [...people]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next) }}>↑</button><button type="button" aria-label={`Move ${singular} ${index + 1} down`} disabled={index === people.length - 1} onClick={() => { const next = [...people]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(next) }}>↓</button><button type="button" aria-label={`Remove ${singular} ${index + 1}`} disabled={people.length === 1 && !person.name} onClick={() => onChange(people.length === 1 ? [{ ...person, name: '' }] : people.filter((p) => p.key !== person.key))}>Remove</button></div>
    </div>)}
    <button type="button" onClick={() => onChange([...people, { key: crypto.randomUUID(), name: '' }])}>Add {singular}</button>
  </fieldset>
}

export function RecordForm({ editing = false }: { editing?: boolean }) {
  usePageTitle(editing ? 'Edit record' : 'Add thesis record')
  const [dirty, setDirty] = useState(false)
  const [authors, setAuthors] = useState<PersonInput[]>([{ key: 'first-author', name: '' }])
  const [advisers, setAdvisers] = useState<PersonInput[]>([{ key: 'first-adviser', name: '' }])
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  return <section className="page"><div className="page-heading"><h1>{editing ? 'Edit record' : 'Add thesis record'}</h1><Link to="/admin/records" className="button">Back to records</Link></div>
    <PhaseNotice />
    {editing && <div className="notice" role="status"><strong>Record not found.</strong> No stored record is available to edit.</div>}
    <form className="record-form" onSubmit={(e) => e.preventDefault()} onChange={() => setDirty(true)}>
      <p>* Required fields for publishing. Drafts may be incomplete.</p>
      <fieldset disabled={editing} className="form-fields">
        <label>Thesis title *<textarea rows={2} placeholder="Enter thesis title" /></label>
        <div className="field-pair"><PeopleFields label="Authors" required disabled={editing} people={authors} onChange={(next) => { setAuthors(next); setDirty(true) }} /><label>Academic year *<input inputMode="numeric" maxLength={9} placeholder="YYYY-YYYY" /></label></div>
        <div className="field-pair"><PeopleFields label="Advisers" disabled={editing} people={advisers} onChange={(next) => { setAdvisers(next); setDirty(true) }} /><label>Topics (optional)<select disabled><option>No topics available yet</option></select><span className="field-note">Topic selection and editing are not available yet.</span></label></div>
        <div className="field-pair"><label>Keywords (optional)<input placeholder="Enter keywords" /><span className="field-note">Keyword editing is a local preview.</span></label><label>Compendium source *<select disabled><option>No sources available yet</option></select><span className="field-note">Required for publishing; optional for a draft.</span></label></div>
        <div className="form-bottom"><label>Abstract (optional)<textarea className="abstract-input" placeholder="Enter the abstract if available" /></label>
          <section className="source-panel stack"><h2>Source details</h2><label>Source row or page (optional)<input placeholder="Enter a source reference" /></label><dl><dt>Compendium</dt><dd>Not provided.</dd><dt>Record ID</dt><dd>Assigned when saved.</dd><dt>Status</dt><dd>No saved record.</dd></dl><div className="stack"><button className="primary" disabled>Save draft</button><button disabled>Review and publish</button></div></section>
        </div>
      </fieldset>
    </form>
    {blocker.state === 'blocked' && <Dialog title="Discard unsaved changes?" onClose={() => blocker.reset()}><p>Your entries have not been saved. Leaving this page will discard them.</p><div className="actions"><button onClick={() => blocker.reset()}>Keep editing</button><button className="primary" onClick={() => blocker.proceed()}>Discard changes</button></div></Dialog>}
  </section>
}
