import { preview } from 'vite'

// Keep the preview in this process so Windows does not need to terminate a
// shell/npm process tree after the suite finishes.
export default async function startPreview() {
  const server = await preview({ preview: { host: '127.0.0.1', port: 4183, strictPort: true } })
  return () => server.close()
}
