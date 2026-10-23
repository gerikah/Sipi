import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { rpc } from './records'
import { loadPublicCatalog } from './public-catalog'
import { matchesCategory, matchesTerms } from './terms'

export type PublicRecord = {
  id: string; title: string; authors: string[]; advisers: string[]; panel_members: string[];
  academicYear: string; abstract: string | null;
  source_name: string; source_created_at: string | null; source_archive_id: string | null;
  group_code: string | null; section_block: string | null;
}
export type SearchResult = { items: PublicRecord[]; page: number; total: number }
export function usePublicQuery<T>(name: string, args: Record<string, unknown>) {
  const key = JSON.stringify(args)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ key: string; name: string; data?: T; error?: string } | null>(null)
  useEffect(() => {
    let active = true
    rpc<T>(name, JSON.parse(key)).then(data => { if (active) setState({ key, name, data }) }).catch(() => {
      if (active) setState({ key, name, error: 'We could not load the records. Try again.' })
    })
    return () => { active = false }
  }, [key, name, attempt])
  const current = state?.key === key && state?.name === name ? state : null
  return { data: current?.data, error: current?.error, retry: () => { setState(null); setAttempt(n => n + 1) } }
}
export function usePublicSearch() {
  const [params] = useSearchParams()
  const key = JSON.stringify({
    q: params.get('q') || '', year_from: params.get('year_from') ? Number(params.get('year_from')) : null,
    year_to: params.get('year_to') ? Number(params.get('year_to')) : null, topic_id: null,
    sort: params.get('sort') || 'newest', page: Math.trunc(Math.max(1, Math.min(100000, Number(params.get('page')) || 1))),
    keyword: params.get('keyword') || '', technology: params.get('technology') || '', category: params.get('category') || '',
  })
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ key: string; data?: SearchResult; error?: string } | null>(null)
  useEffect(() => {
    let active = true
    async function load() {
      const { keyword, technology, category, page, ...query } = JSON.parse(key)
      if (!keyword && !technology && !category) return rpc<SearchResult>('search_records', { ...query, page })
      const records = await loadPublicCatalog(query, () => !active)
      if (!records) return undefined
      const items = records.filter(record => matchesTerms(record, keyword, technology) && matchesCategory(record, category))
      return { total: items.length, page, items: items.slice((page - 1) * 24, page * 24) }
    }
    void load().then(data => { if (active) setState({ key, data }) }).catch(cause => {
      if (active) setState({ key, error: cause instanceof Error && !('code' in cause) ? cause.message : 'We could not load the records. Try again.' })
    })
    return () => { active = false }
  }, [key, attempt])
  const current = state?.key === key ? state : null
  return { data: current?.data, error: current?.error, retry: () => { setState(null); setAttempt(n => n + 1) } }
}
