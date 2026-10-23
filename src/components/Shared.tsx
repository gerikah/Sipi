import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Logo({ large = false }: { large?: boolean }) {
  return <Link to="/" className={`logo${large ? ' logo-large' : ''}`}><img src="/images/Logo Word.png" width="500" height="193" alt="Sipi home" /></Link>
}

export function Icon({ name }: { name: 'search' | 'sun' | 'moon' | 'filter' | 'arrow' }) {
  const paths = {
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" /></>,
    moon: <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z" />,
    filter: <><path d="M3 6h18M3 12h18M3 18h18" /><path d="M8 3v6m8 0v6m-8 0v6" /></>,
    arrow: <path d="m14 5-7 7 7 7M7 12h14" />,
  }
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function SourceNote() {
  return <p>Sipi is a thesis record repository for the Computer Engineering Department of PUP Main Campus, Sta. Mesa, Manila. The supplied compendium subset covers academic years 2015–2016, 2018–2019, and 2019–2020. These are separate academic years, not continuous coverage. Records appear here after administrator review and publication.</p>
}

export function ImageArea({ className = '', src, alt = '' }: { className?: string; src?: string; alt?: string }) {
  if (src) return <div className={`image-area image-filled ${className}`}><img src={src} alt={alt} loading="lazy" decoding="async" /></div>
  return <div className={`image-area ${className}`} aria-hidden="true" />
}

export function PhaseNotice() {
  return <p className="notice">Record changes are not available yet. Form entries stay on this page and are not saved.</p>
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty-state" role="status"><h2>{title}</h2>{children}</div>
}

export function Pagination() {
  return <nav className="pagination" aria-label="Pagination"><button disabled>Previous</button><span>No pages to show</span><button disabled>Next</button></nav>
}

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = ref.current!
    dialog.showModal()
    return () => { dialog.close(); trigger?.focus() }
  }, [])
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); onClose() }} onKeyDown={(event) => {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex="0"]')).filter((control) => !control.matches(':disabled') && control.offsetParent !== null)
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}>
    <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog">Close</button></div>
    <div className="dialog-content">{children}</div>
  </dialog>
}
