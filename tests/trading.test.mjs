import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'

const require = createRequire(import.meta.url)
const logic = require('../functions/trade-logic.js')
const source = await readFile(new URL('../functions/trading.js', import.meta.url), 'utf8')
const card = { id: 'entry', cardId: 'sv03-223', name: 'Charizard ex', image: null, setName: 'Obsidian Flames', localId: '223', variant: 'holo', language: 'English', condition: 'Lightly Played', quantity: 4, forTrade: true, tradeQuantity: 3 }
const wish = { cardId: card.cardId, variant: 'holo', language: 'English', minimumCondition: 'Moderately Played' }

test('matching respects card identity, variants, languages and ordered minimum condition', () => {
  assert.equal(logic.matchesWish(card, wish), true)
  assert.equal(logic.matchesWish(card, { cardId: card.cardId }), true)
  for (const changed of [{ cardId: 'other' }, { variant: 'reverse' }, { language: 'Japanese' }, { minimumCondition: 'Near Mint' }]) {
    assert.equal(logic.matchesWish(card, { ...wish, ...changed }), false)
  }
  assert.equal(logic.matchesWish({ ...card, condition: 'Unknown' }, wish), false)
})

test('trade copies preserve kept copies and exclude stock committed to active sales', () => {
  assert.equal(logic.available(card), 3)
  assert.equal(logic.available(card, { status: 'active', quantity: 2 }), 2)
  assert.equal(logic.available(card, { status: 'active', quantity: 4 }), 0)
  assert.equal(logic.available(card, { status: 'sold', quantity: 4 }), 3)
  assert.equal(logic.available({ ...card, forTrade: false }), 0)
  assert.equal(logic.available({ ...card, tradeQuantity: undefined }), 4) // Existing entries keep their old meaning.
  assert.equal(logic.available({ ...card, tradeQuantity: 99 }), 4)
})

test('proposals require a bounded, unique, positive and available selection on each side', () => {
  const cards = logic.matchingCards([card], [wish])
  assert.equal(logic.selectLines([{ entryId: 'entry', quantity: 2 }], cards)[0].quantity, 2)
  for (const quantity of [0, -1, 1.5, 4, NaN, '1']) assert.throws(() => logic.selectLines([{ entryId: 'entry', quantity }], cards))
  assert.throws(() => logic.selectLines([], cards))
  assert.throws(() => logic.selectLines([{ entryId: 'unknown', quantity: 1 }], cards))
  assert.throws(() => logic.selectLines(Array(2).fill({ entryId: 'entry', quantity: 1 }), cards))
  assert.throws(() => logic.selectLines(Array(11).fill({ entryId: 'entry', quantity: 1 }), cards))
})

// Execute the actual callable handlers against an isolated Firestore boundary.
// These tests do not emulate deployed Firebase rules or browser authentication.
function harness() {
  const records = new Map()
  const snapshot = path => ({ id: path.split('/').at(-1), exists: records.has(path), data: () => records.get(path) })
  const document = path => ({ path, id: path.split('/').at(-1), get: async () => snapshot(path) })
  function collection(path, filters = [], cursor = null, maximum = Infinity) {
    return {
      where: (key, _operator, value) => collection(path, [...filters, [key, value]], cursor, maximum),
      orderBy: () => collection(path, filters, cursor, maximum),
      startAfter: value => collection(path, filters, value, maximum),
      limit: value => collection(path, filters, cursor, value),
      get: async () => {
        const docs = [...records.keys()].filter(key => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1)
          .filter(key => filters.every(([field, value]) => records.get(key)[field] === value))
          .sort().filter(key => !cursor || key.split('/').at(-1) > cursor).slice(0, maximum).map(snapshot)
        return { docs, size: docs.length }
      },
    }
  }
  const hooks = { beforeTransaction: null }
  const db = { doc: document, collection, runTransaction: async callback => {
    hooks.beforeTransaction?.()
    const writes = []
    await callback({
      get: async target => { assert.equal(writes.length, 0, 'Firestore reads must precede writes'); return snapshot(target.path) },
      set: (target, value) => writes.push(() => records.set(target.path, value)),
      update: (target, value) => writes.push(() => records.set(target.path, { ...records.get(target.path), ...value })),
    })
    writes.forEach(write => write())
  } }
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code } }
  const exports = {}
  vm.runInNewContext(source, { exports, require: name => {
    if (name === 'firebase-functions/v2/https') return { onCall: callback => callback, HttpsError }
    if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldValue: { serverTimestamp: () => 123 }, FieldPath: { documentId: () => '__name__' } }
    if (name === './trade-logic') return logic
    throw new Error('Unexpected module: ' + name)
  } })
  function seed(uid, overrides = {}) {
    records.set(`tradingMembers/${uid}`, { enabled: true })
    records.set(`publicProfiles/${uid}`, { displayName: uid, location: 'Copenhagen', tradesPublic: true, email: 'must-not-leak@example.test' })
    records.set(`profiles/${uid}/collection/entry`, { ...card, ...overrides })
    records.set(`profiles/${uid}/wishlist/wish`, wish)
    records.set(`profiles/${uid}/wishlist/private`, { cardId: 'secret-wish' })
  }
  return { api: exports, records, hooks, seed }
}
const request = (uid, data = {}) => ({ auth: uid ? { uid } : null, data })
const proposal = { recipientId: 'bob', proposalId: '00000000-0000-4000-8000-000000000001', give: [{ entryId: 'entry', quantity: 1 }], receive: [{ entryId: 'entry', quantity: 2 }], message: 'Local pickup?' }

test('all callable operations require authentication', async () => {
  const { api } = harness()
  for (const handler of Object.values(api)) await assert.rejects(handler(request(null)), error => error.code === 'unauthenticated')
})

test('matches require mutual interest, consent and shared trade cards; results exclude unrelated private data', async () => {
  const { api, records, seed } = harness()
  seed('alice'); seed('bob'); seed('carol'); seed('dave'); seed('erin')
  records.set('tradingMembers/carol', { enabled: false })
  records.delete('publicProfiles/dave')
  records.set('profiles/erin/wishlist/wish', { cardId: 'something-else' })
  const result = await api.findTradeMatches(request('alice'))
  assert.deepEqual(Array.from(result.matches, item => item.uid), ['bob'])
  const serialized = JSON.stringify(result)
  for (const forbidden of ['secret-wish', 'must-not-leak', 'tradeQuantity', 'createdAt', 'wishlist']) assert.equal(serialized.includes(forbidden), false)
  assert.equal(result.matches[0].give[0].quantity, 3)
  records.set('tradingMembers/alice', { enabled: false })
  await assert.rejects(api.findTradeMatches(request('alice')), error => error.code === 'failed-precondition')
})

test('matching paginates participating collectors without silently dropping later matches', async () => {
  const { api, seed } = harness()
  seed('alice')
  for (let index = 0; index < 13; index++) seed('collector-' + String(index).padStart(2, '0'))
  const first = await api.findTradeMatches(request('alice'))
  const second = await api.findTradeMatches(request('alice', { cursor: first.cursor }))
  assert.equal(first.matches.length + second.matches.length, 13)
  assert.equal(second.cursor, null)
  assert.equal(new Set([...first.matches, ...second.matches].map(item => item.uid)).size, 13)
})

test('send is idempotent, keeps exact quantities and never modifies inventory', async () => {
  const { api, records, seed } = harness()
  seed('alice'); seed('bob')
  await api.sendTradeProposal(request('alice', proposal))
  await api.sendTradeProposal(request('alice', proposal))
  assert.equal([...records.keys()].filter(key => key.startsWith('trades/')).length, 1)
  const trade = records.get('trades/' + proposal.proposalId)
  assert.equal(trade.give[0].quantity, 1)
  assert.equal(trade.receive[0].quantity, 2)
  assert.equal(trade.status, 'pending')
  assert.equal(records.get('profiles/alice/collection/entry').quantity, 4)
  assert.equal(records.get('profiles/bob/collection/entry').quantity, 4)
})

test('send rejects stale stock and withdrawn consent inside its transaction', async () => {
  for (const change of ['stock', 'variant', 'consent', 'profile']) {
    const { api, records, seed, hooks } = harness()
    seed('alice'); seed('bob')
    hooks.beforeTransaction = () => {
      if (change === 'stock') records.set('listings/bob_entry', { status: 'active', quantity: 4 })
      if (change === 'variant') records.set('profiles/bob/collection/entry', { ...card, variant: 'reverse' })
      if (change === 'consent') records.set('tradingMembers/bob', { enabled: false })
      if (change === 'profile') records.delete('publicProfiles/bob')
    }
    await assert.rejects(api.sendTradeProposal(request('alice', proposal)), error => error.code === 'failed-precondition')
    assert.equal(records.has('trades/' + proposal.proposalId), false)
  }
})

test('only recipient accepts, acceptance checks current stock, and completion needs both participants', async () => {
  const { api, records, seed } = harness()
  seed('alice'); seed('bob')
  await api.sendTradeProposal(request('alice', proposal))
  const data = action => ({ id: proposal.proposalId, action })
  await assert.rejects(api.respondToTrade(request('eve', data('accept'))))
  await assert.rejects(api.respondToTrade(request('alice', data('accept'))))
  records.set('listings/bob_entry', { status: 'active', quantity: 4 })
  await assert.rejects(api.respondToTrade(request('bob', data('accept'))))
  records.delete('listings/bob_entry')
  await api.respondToTrade(request('bob', data('accept')))
  await api.respondToTrade(request('alice', data('complete')))
  await api.respondToTrade(request('alice', data('complete')))
  assert.equal(records.get('trades/' + proposal.proposalId).status, 'accepted')
  await api.respondToTrade(request('bob', data('complete')))
  assert.equal(records.get('trades/' + proposal.proposalId).status, 'completed')
  await assert.rejects(api.respondToTrade(request('alice', data('cancel'))))
})

test('declines and cancellations are terminal and enforce participant roles', () => {
  const trade = { participants: ['alice', 'bob'], senderId: 'alice', recipientId: 'bob', status: 'pending' }
  assert.equal(logic.nextState(trade, 'bob', 'decline').status, 'declined')
  assert.equal(logic.nextState(trade, 'alice', 'cancel').status, 'cancelled')
  assert.throws(() => logic.nextState(trade, 'bob', 'cancel'))
  assert.throws(() => logic.nextState({ ...trade, status: 'declined' }, 'bob', 'accept'))
  assert.throws(() => logic.nextState({ ...trade, status: 'cancelled' }, 'alice', 'complete'))
})
