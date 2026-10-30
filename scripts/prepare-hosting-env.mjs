import { readFile, writeFile } from 'node:fs/promises'
import { hostingEnv } from './firebase-config.mjs'

const root = new URL('../', import.meta.url)
const { projects } = JSON.parse(await readFile(new URL('.firebaserc', root), 'utf8'))
const projectId = projects.default
if (!/^[a-z][a-z0-9-]+$/.test(projectId)) throw new Error('Invalid default Firebase project ID.')

// This endpoint contains public web-app configuration, never Admin SDK credentials.
const response = await fetch(`https://${projectId}.web.app/__/firebase/init.json`, {
  signal: AbortSignal.timeout(15000),
})
if (!response.ok) throw new Error(`Could not load Firebase Hosting configuration (HTTP ${response.status}).`)
const contents = hostingEnv(await response.json(), projectId)
await writeFile(new URL('.env.production.local', root), contents, { mode: 0o600 })
console.log(`Prepared production configuration for ${projectId}.`)
