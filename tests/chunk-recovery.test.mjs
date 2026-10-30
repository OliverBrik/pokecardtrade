import assert from 'node:assert/strict'
import test from 'node:test'
import { installChunkRecovery } from '../src/services/chunk-recovery.js'

test('a stale dynamic import reloads once, preserving the current URL and avoiding a reload loop', () => {
  let handler, value = null, reloads = 0, prevented = 0
  const browser = {
    addEventListener: (name, callback) => { assert.equal(name, 'vite:preloadError'); handler = callback },
    sessionStorage: { getItem: () => value, setItem: (_key, next) => { value = next } },
    location: { reload: () => { reloads++ } },
  }
  installChunkRecovery(browser)
  const event = { preventDefault: () => { prevented++ } }
  handler(event)
  handler(event)
  assert.equal(reloads, 1)
  assert.equal(prevented, 1)
  value = String(Date.now() - 61000)
  handler(event)
  assert.equal(reloads, 2)
})

test('blocked browser storage cannot produce an uncontrolled reload loop', () => {
  let handler
  installChunkRecovery({
    addEventListener: (_name, callback) => { handler = callback },
    sessionStorage: { getItem: () => { throw new Error('Storage disabled') } },
    location: { reload: () => assert.fail('Must not reload without a persistent loop guard') },
  })
  handler({ preventDefault: () => assert.fail('The original error must remain observable') })
})
