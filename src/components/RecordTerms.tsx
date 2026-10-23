import { recordCategory, sourceTerms } from '../lib/terms'
import type { PublicRecord } from '../lib/discovery'

export function RecordTerms({ record, compact = false }: { record: PublicRecord; compact?: boolean }) {
  const terms = sourceTerms(record), grouping = recordCategory(record)
  const ordered = [...terms.filter(term => term.kind === 'technology'), ...terms.filter(term => term.kind === 'keyword')]
  const unique = ordered.filter((term, index) => ordered.findIndex(other => other.label.toLowerCase() === term.label.toLowerCase()) === index)
  const shown = compact ? unique.slice(0, unique.length > 2 ? 1 : 2) : unique
  const chips = <div className={compact ? 'card-tags' : 'record-tags'} aria-label="Record tags">
    <span className={`record-tag category-tag tag-${grouping.key}`} title={`Automatic grouping. Hardware mentions: ${grouping.hardware.join(', ') || 'none detected'}. Software mentions: ${grouping.software.join(', ') || 'none detected'}.`}>{grouping.label} · auto</span>
    {shown.map(term => <span key={term.key} className={`record-tag tag-${term.kind}`} title={`${term.kind === 'keyword' ? 'Source keyword/index term' : 'Technology mentioned'}: ${term.label}`}>{term.label}</span>)}
    {compact && unique.length > shown.length && <span className="record-tag tag-more" title="Open the record to see all tags">+{unique.length - shown.length} more tags</span>}
  </div>
  if (compact) return chips
  return <section id="record-terms" className="record-terms stack" aria-labelledby="record-terms-title"><h2 id="record-terms-title">Tags from the source</h2>{chips}
    <p className="field-note">Keywords and index terms come from labeled lists in the abstract. Technologies are explicit mentions, not a verified complete tech stack. Hardware/software grouping is automatic and may need review.</p>
  </section>
}
