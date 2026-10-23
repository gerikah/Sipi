import { supabase } from './supabase'
import { retryAccess } from './auth'

export type Status = 'draft' | 'published' | 'archived'
export type Person = { id?: string; faculty_id?: string; full_name?: string; display_name?: string }
export type Thesis = {
  id: string; repository_code: string; title: string | null; academic_year_id: string | null; academic_year: string | null;
  source_id: string | null; source_name: string | null; source_archive_id: string | null; source_row_number: number | null;
  source_created_at: string | null; group_code: string | null; section_block: string | null; abstract: string | null;
  status: Status; version: number; authors: Person[]; advisers: Person[]; panel_members: Person[]; topic_ids: string[]; keyword_ids: string[];
}
export type Choice = { id: string; name: string }
export type Options = { years: Choice[]; sources: Choice[] }
export const emptyOptions: Options = { years: [], sources: [] }
export class RecordError extends Error { constructor(message: string, public code?: string) { super(message) } }
export function explain(error: unknown): string {
  const code = (error as { code?: string })?.code
  if (code === '40001') return 'This record changed while you were editing. Reload the latest version before saving.'
  if (code === '42501' || code === 'PGRST301') return 'Administrator access could not be verified. Log in again or ask the project owner.'
  if (code === 'PGRST202' || code === '42883') return 'Record management is not configured in this database yet. The pending migrations must be applied.'
  if (code === '23505') return 'This source archive ID or classification already exists. Review it before continuing.'
  if (code === '23514') return 'Publishing requires a title, academic year, at least one author and a compendium source. Supplied values must be valid.'
  if (code === '23503') return 'A selected year, source or classification is no longer available. Reload the choices and try again.'
  if (code === '22023' || code === '22P02' || code === '22007' || code === '22008' || code === '22003') return 'Some supplied values are invalid. Check the field formats and try again.'
  return 'We could not complete the request. Check your connection and try again. Your entries have been kept.'
}
export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new RecordError('Not configured', 'PGRST202')
  const { data, error } = await supabase.rpc(name, args)
  if (error) { if (error.code === '42501' || error.code === 'PGRST301') retryAccess(); throw new RecordError(error.message, error.code) }
  return data as T
}
export async function loadOptions(): Promise<Options> {
  if (!supabase) throw new RecordError('Not configured','PGRST202')
  const results = await Promise.all([
    supabase.from('academic_years').select('id,label').order('start_year', { ascending: false }).limit(1001),
    supabase.from('sources').select('id,name').order('name').limit(1001),
  ])
  for (const result of results) { if (result.error) throw new RecordError(result.error.message,result.error.code); if (result.data!.length >= 1000) throw new Error('Too many choices; catalog pagination is required') }
  return { years: results[0].data!.map(item => ({ id: item.id, name: 'label' in item ? String(item.label) : '' })), sources: results[1].data as Choice[] }
}
