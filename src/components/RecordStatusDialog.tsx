import { useRef, useState } from 'react'
import { Dialog } from './Shared'
import { explain, rpc, type Status, type Thesis } from '../lib/records'

export const statusLabel = (status: Status) => status === 'published' ? 'Publish' : status === 'archived' ? 'Archive' : 'Return to draft'
export function RecordStatusDialog({ record, status, onClose, onSuccess }: { record: Thesis; status: Status; onClose: () => void; onSuccess: () => void }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  return <Dialog title={`${statusLabel(status)} this record?`} onClose={() => { if (!lock.current) onClose() }}>
    <p>{record.title || 'Untitled draft'}</p>
    <p>{status === 'archived' ? 'It will no longer appear in public searches. Its metadata will be kept.' : status === 'published' ? 'The record and its public metadata will become visible to visitors.' : 'The record will be a draft and will not appear in public searches.'}</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions"><button disabled={pending || !!error} className="primary" onClick={async () => {
      if (lock.current) return
      lock.current = true; setPending(true); setError('')
      try { await rpc('set_record_status', { id: record.id, status, expected_version: record.version }); onSuccess() }
      catch (cause) { setError(`${explain(cause)} Close this dialog and reload the records before trying again.`) }
      finally { lock.current = false; setPending(false) }
    }}>{pending ? 'Updating…' : statusLabel(status)}</button><button disabled={pending} onClick={onClose}>Cancel</button></div>
  </Dialog>
}
