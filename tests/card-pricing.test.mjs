import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const collectionSource = (await readFile(new URL('../src/services/collection.js', import.meta.url), 'utf8')).replace(/^import .*\r?\n/gm, '')
const { entryPrice } = await import(`data:text/javascript;base64,${Buffer.from(collectionSource).toString('base64')}`)
const cardsSource = await readFile(new URL('../src/services/cards.js', import.meta.url), 'utf8')
const cards = await import(`data:text/javascript;base64,${Buffer.from(`
let payload;
const fetch=async()=>({ok:true,json:async()=>payload});
export function fixture(value){payload=value;}
` + cardsSource).toString('base64')}`)

const holoOnly = { firstEdition: false, holo: true, normal: false, reverse: false, wPromo: false }

test('holo-only ex cards use their base product price when the holo field is zero or missing', async () => {
  for (const [id, trend] of [['sv03-223', 105.81], ['sv03.5-003', 2.47]]) {
    cards.fixture({ id, name: 'Example ex', variants: holoOnly, pricing: { cardmarket: { unit: 'EUR', trend, 'trend-holo': 0 } } })
    const card = await cards.getCard(id)
    assert.equal(card.prices.trendHolo, null)
    assert.equal(entryPrice(card, 'holo'), trend)
    assert.equal(entryPrice({ ...card, prices: { trend } }, 'holo'), trend)
  }
})

test('variant estimates keep reverse and normal values separate and never invent zero prices', () => {
  const card = { variants: { normal: true, reverse: true, holo: false }, prices: { trend: 0.15, trendHolo: 3.31 } }
  assert.equal(entryPrice(card, 'normal'), 0.15)
  assert.equal(entryPrice(card, 'reverse'), 3.31)
  assert.equal(entryPrice({ ...card, prices: { trend: 0.15, trendHolo: 0 } }, 'reverse'), null)
  assert.equal(entryPrice({ variants: { normal: true, holo: true }, prices: { trend: 10, trendHolo: 0 } }, 'holo'), null)
  assert.equal(entryPrice({ prices: { trend: 10, trendHolo: 0 } }, 'holo'), null)
  assert.equal(entryPrice({ variants: holoOnly, prices: { trend: 10, trendHolo: 12 } }, 'holo'), 12)
  for (const value of [0, -1, NaN, Infinity, undefined, null, '10']) {
    assert.equal(entryPrice({ variants: holoOnly, prices: { trend: value, trendHolo: value } }, 'holo'), null)
    assert.equal(entryPrice({ prices: { trend: value } }, 'normal'), null)
  }
  assert.equal(entryPrice(card, 'firstEdition'), null)
  assert.equal(entryPrice(null, 'normal'), null)
})

test('price normalization preserves unknowns and EUR-only pricing throughout card details', async () => {
  cards.fixture({ id: 'test', pricing: { cardmarket: { unit: 'EUR', trend: 0, low: null, avg: -1, 'trend-holo': 2 } } })
  const card = await cards.getCard('test')
  assert.equal(card.prices.trend, null)
  assert.equal(card.prices.low, null)
  assert.equal(card.prices.average, null)
  assert.equal(card.prices.trendHolo, 2)
  cards.fixture({ id: 'test', pricing: { cardmarket: { unit: 'USD', trend: 50 } } })
  assert.equal((await cards.getCard('test')).prices, null)
})
