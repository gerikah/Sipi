import { rpc } from './records'
import type { PublicRecord, SearchResult } from './discovery'

export const MAX_CATALOG_RECORDS = 2000
export async function loadPublicCatalog(args: Record<string, unknown>, cancelled: () => boolean = () => false) {
  const items: PublicRecord[] = [], seen = new Set<string>()
  let total = 0
  for (let page = 1; page === 1 || items.length < total; page++) {
    if (cancelled()) return null
    const result = await rpc<SearchResult>('search_records', { ...args, page })
    if (cancelled()) return null
    if (result.total > MAX_CATALOG_RECORDS) throw new Error('Term filters currently support up to 2,000 matching published records. Narrow the search or academic years before using these filters.')
    if (page > 1 && result.total !== total) throw new Error('The records changed while filters were loading. Try again.')
    total = result.total
    for (const record of result.items) {
      if (seen.has(record.id)) throw new Error('The records changed while filters were loading. Try again.')
      seen.add(record.id); items.push(record)
    }
    if (!result.items.length && items.length < total) throw new Error('The records changed while filters were loading. Try again.')
  }
  return items
}
