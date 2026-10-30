import assert from 'node:assert/strict'
import test from 'node:test'
import { loadEnv } from 'vite'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { firebaseFields, hostingEnv, validateFirebaseEnv } from '../scripts/firebase-config.mjs'

const projectId = 'test-project'
const config = { apiKey: 'test-key', authDomain: 'test-project.firebaseapp.com', projectId,
  storageBucket: 'test-project.firebasestorage.app', messagingSenderId: '123', appId: '1:123:web:test' }

test('build configuration rejects missing values and another Firebase project', () => {
  const env = Object.fromEntries(Object.entries(firebaseFields).map(([field, key]) => [key, config[field]]))
  validateFirebaseEnv(env, projectId)
  assert.throws(() => validateFirebaseEnv({ ...env, VITE_FIREBASE_API_KEY: '' }, projectId), /VITE_FIREBASE_API_KEY/)
  assert.throws(() => validateFirebaseEnv(env, 'another-project'), /must match/)
  assert.throws(() => hostingEnv({ ...config, apiKey: 'bad\nvalue' }, projectId), /single-line/)
})

test('Hosting configuration round-trips through the actual Vite environment loader', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kardvia-env-'))
  try {
    await writeFile(join(directory, '.env.production.local'), hostingEnv(config, projectId))
    const env = loadEnv('production', directory, 'VITE_')
    for (const [field, key] of Object.entries(firebaseFields)) assert.equal(env[key], config[field])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
