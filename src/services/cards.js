const API_URL = 'https://api.tcgdex.net/v2/en'
let unavailableUntil = 0

function reportOffline(source) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kardvia:catalogue-offline', { detail: { source } }))
}

async function request(path, signal) {
  let failure
  try {
    if (Date.now() < unavailableUntil) throw new Error('Catalogue temporarily unavailable.')
    const timeout = AbortSignal.timeout(6000)
    const response = await fetch(`${API_URL}${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
    if (!response.ok) {
      const error = new Error(response.status === 404 ? 'Card or catalogue endpoint unavailable.' : `Could not load card data (HTTP ${response.status}).`)
      error.status = response.status
      throw error
    }
    const data = await response.json()
    try { if (typeof window !== 'undefined') window.localStorage.setItem(`kardvia:catalogue:v1:${path}`, JSON.stringify({ savedAt: Date.now(), data })) } catch { /* Storage may be full or disabled. */ }
    return data
  } catch (cause) {
    if (signal?.aborted) throw cause
    failure = cause
    // Stop an outage causing hundreds of requests when opening a collection.
    if (!cause.status || cause.status >= 500 || cause.status === 429) unavailableUntil = Date.now() + 15000
  }
  try {
    const cached = typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem(`kardvia:catalogue:v1:${path}`)) : null
    if (cached && Date.now() - cached.savedAt < 7 * 86400000) {
      unavailableUntil = Date.now() + 15000
      reportOffline('cache')
      return Array.isArray(cached.data) ? cached.data.map(item => typeof item === 'object' ? { ...item, _offline: true } : item) : { ...cached.data, _offline: true }
    }
  } catch { /* Continue to the bundled catalogue. */ }
  const { offlineResponse } = await import('./offline-catalogue.js')
  const fallback = offlineResponse(path)
  if (fallback !== null) { unavailableUntil = Date.now() + 15000; reportOffline('snapshot'); return fallback }
  throw failure
}

function cardSummary(card) {
  return {
    id: card.id,
    name: card.name,
    localId: card.localId,
    offline: card._offline === true,
    image: card.image ? `${card.image}/high.webp` : null,
    thumbnail: card.image ? `${card.image}/low.webp` : null,
  }
}

function priceOrNull(value) {
  // Cardmarket uses zero for some unavailable variant prices; it is not a valuation.
  return Number.isFinite(value) && value > 0 ? value : null
}

function cardmarketPrices(market) {
  if (!market || market.unit !== 'EUR') return null

  return {
    source: 'Cardmarket',
    currency: 'EUR',
    updatedAt: market.updated ?? null,
    productId: market.idProduct ?? null,
    trend: priceOrNull(market.trend),
    average: priceOrNull(market.avg),
    low: priceOrNull(market.low),
    trendHolo: priceOrNull(market['trend-holo']),
    averageHolo: priceOrNull(market['avg-holo']),
    lowHolo: priceOrNull(market['low-holo']),
  }
}

export async function getCard(cardId, { signal } = {}) {
  if (typeof cardId !== 'string' || !cardId.trim()) {
    throw new TypeError('Enter a card ID, for example swsh3-136.')
  }

  const card = await request(`/cards/${encodeURIComponent(cardId.trim())}`, signal)

  return {
    ...cardSummary(card),
    set: card.set ?? null,
    rarity: card.rarity ?? null,
    variants: card.variants ?? {},
    prices: cardmarketPrices(card.pricing?.cardmarket),
    detailedVariants: (card.variants_detailed ?? []).map((variant) => ({
      id: variant.variantId,
      type: variant.type,
      size: variant.size,
      prices: cardmarketPrices(variant.pricing?.cardmarket),
    })),
  }
}

export async function searchCards(name, { page = 1, pageSize = 20, signal } = {}) {
  if (typeof name !== 'string') throw new TypeError('Search text must be a string.')
  if (!name.trim()) return []
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError('Page must be a positive integer.')
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new RangeError('Page size must be an integer between 1 and 100.')
  }

  const query = new URLSearchParams({
    name: `like:${name.trim()}`,
    'pagination:page': String(page),
    'pagination:itemsPerPage': String(pageSize),
  })
  const cards = await request(`/cards?${query}`, signal)
  return cards.map(cardSummary)
}

export async function browseCards({ name = '', set = '', rarity = '', number = '', page = 1, signal } = {}) {
  if (!Number.isInteger(page) || page < 1) throw new RangeError('Invalid page.')
  const query = new URLSearchParams({
    'pagination:page': String(page),
    'pagination:itemsPerPage': '10',
  })
  if (name.trim()) query.set('name', `like:${name.trim()}`)
  if (set) query.set('set.id', `eq:${set}`)
  if (rarity) query.set('rarity', `eq:${rarity}`)
  if (number.trim()) query.set('localId', `eq:${number.trim()}`)
  return (await request(`/cards?${query}`, signal)).map(cardSummary)
}

export function getSets({ signal } = {}) {
  return request('/sets', signal)
}

export async function getSet(setId, { signal } = {}) {
  if (typeof setId !== 'string' || !/^[a-zA-Z0-9.-]{1,80}$/.test(setId)) throw new TypeError('Choose a valid set.')
  const timeout = AbortSignal.timeout(15000)
  const set = await request(`/sets/${encodeURIComponent(setId)}`, signal ? AbortSignal.any([signal, timeout]) : timeout)
  if (!Array.isArray(set.cards) || !set.cards.length || set.id !== setId) throw new Error('This set does not have a usable card checklist yet.')
  const cards = [...new Map(set.cards.map(card => [card.id, cardSummary(card)])).values()]
  if (set.cardCount?.total !== cards.length) throw new Error('The set checklist is incomplete. Please try again later.')
  return { id: set.id, name: set.name, cards, offline: set._offline === true }
}

export function getRarities({ signal } = {}) {
  return request('/rarities', signal)
}
