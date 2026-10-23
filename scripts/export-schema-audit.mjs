import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { disposableDatabase } from './lib/disposable-db.mjs'
const db = await disposableDatabase()
try {
  const audit = (await db.query(await readFile('scripts/database-audit.sql', 'utf8'))).rows[0].schema_audit
  const migrations = await Promise.all((await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort().map(async file => ({ file, sha256: createHash('sha256').update(await readFile(`supabase/migrations/${file}`)).digest('hex') })))
  await mkdir('.local/release', { recursive: true })
  await writeFile('.local/release/expected-schema-audit.json', JSON.stringify({ migrations, audit }, null, 2))
  console.log(JSON.stringify({ migrations: migrations.length, tables: audit.tables.length, functions: audit.functions.length, output: '.local/release/expected-schema-audit.json' }))
} finally { await db.close() }
