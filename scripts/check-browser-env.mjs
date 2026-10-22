import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), '')
const rootFiles = await readdir('.')
for (const name of rootFiles.filter(name => name.startsWith('.env') && name !== '.env.example')) {
  try { execFileSync('git', ['check-ignore', '--quiet', name], { stdio: 'ignore' }) }
  catch { throw new Error('An environment file is not ignored by Git.') }
}
async function files(path) {
  const entries = await readdir(path, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(`${path}/${entry.name}`) : `${path}/${entry.name}`))).flat()
}
const output = await Promise.all((await files('dist')).map(path => readFile(path)))
const sensitive = Object.entries(env).filter(([name, value]) => value.length >= 8 && /SECRET|SERVICE_ROLE|PASSWORD|DATABASE_URL|PRIVATE_KEY/.test(name))
for (const [, value] of sensitive) {
  if (output.some(file => file.includes(value) || file.includes(JSON.stringify(value).slice(1, -1)))) {
    throw new Error('A sensitive environment value was found in the build. Do not deploy it.')
  }
}
console.log('Environment files are ignored; configured sensitive values are absent from dist.')
