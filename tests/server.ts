import { build, preview } from 'vite'

// Keep the preview in this process so Windows does not need to terminate a
// shell/npm process tree after the suite finishes.
export default async function startPreview() {
  // Isolated browser fixtures can never contact the configured remote project.
  await build({ mode: 'test', build: { outDir: '.local/test-dist' }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54321'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_isolated_browser_test'),
  } })
  const server = await preview({ build: { outDir: '.local/test-dist' }, preview: { host: '127.0.0.1', port: 4183, strictPort: true } })
  return () => server.close()
}
