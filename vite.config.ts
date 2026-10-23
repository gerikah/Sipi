import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Opt out of Vite's automatic VITE_* exposure. Only these two values enter JS.
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || ''
  if (key && !key.startsWith('sb_publishable_')) {
    let role = ''
    try { role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role } catch { /* Reject unknown keys without logging them. */ }
    if (role !== 'anon') throw new Error('Browser configuration requires a publishable or anon key.')
  }
  return {
    plugins: [react()],
    envPrefix: [],
    build: { rolldownOptions: { output: { codeSplitting: { groups: [
      { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
      { name: 'react', test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/ },
    ] } } } },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key),
    },
  }
})
