import assert from 'node:assert/strict'
import test from 'node:test'
import { offlineResponse } from '../src/services/offline-catalogue.js'
import snapshot from '../src/data/catalogue-snapshot.js'

test('the bundled catalogue contains two complete real checklists with no invented prices', () => {
  assert.equal(snapshot.cards.length, 437)
  for (const set of offlineResponse('/sets')) {
    const complete = offlineResponse('/sets/' + set.id)
    assert.equal(complete.cards.length, set.cardCount.total)
    assert.equal(new Set(complete.cards.map(card => card.id)).size, set.cardCount.total)
    assert.ok(complete.cards.every(card => card.pricing === null && Object.values(card.variants).some(Boolean)))
  }
})

test('offline search respects name, set, rarity, card number and pagination', () => {
  assert.equal(offlineResponse('/cards?name=like:charizard&set.id=eq:sv03').every(card => card.name.includes('Charizard') && card.set.id === 'sv03'), true)
  const a = offlineResponse('/cards?pagination:itemsPerPage=10&pagination:page=1')
  const b = offlineResponse('/cards?pagination:itemsPerPage=10&pagination:page=2')
  assert.equal(a.length, 10); assert.equal(b.length, 10)
  assert.equal(a.some(card => b.some(other => other.id === card.id)), false)
  assert.equal(offlineResponse('/cards?set.id=eq:sv03.5&localId=eq:003')[0].name, 'Venusaur ex')
  assert.equal(offlineResponse('/cards/unknown'), null)
  assert.equal(offlineResponse('/sets/unknown'), null)
})

test('the real card service recovers from an API outage using the bundled data and keeps prices unknown', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 404 })
  try {
    const { getCard, getSet, getSets, browseCards } = await import('../src/services/cards.js')
    const card = await getCard('sv03-223')
    assert.equal(card.name, 'Charizard ex'); assert.equal(card.offline, true); assert.equal(card.prices, null)
    assert.equal((await getSet('sv03')).cards.length, 230)
    assert.equal((await getSets()).length, 2)
    assert.ok((await browseCards({ name: 'Venusaur' })).length > 0)
    const abort = new AbortController(); abort.abort()
    await assert.rejects(getCard('unknown', { signal: abort.signal }))
  } finally { globalThis.fetch = original }
})
