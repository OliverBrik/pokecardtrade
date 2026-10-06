// TCGdex supplies card information and Cardmarket prices. No API key is needed.
// Views/composables handle loading states and catch errors from this service.
const API_URL = 'https://api.tcgdex.net/v2/en'

async function request(path, signal) {
  const response = await fetch(`${API_URL}${path}`, { signal })

  if (!response.ok) {
    const error = new Error(
      response.status === 404
        ? 'Card not found.'
        : `Could not load card data (HTTP ${response.status}).`,
    )
    error.status = response.status
    throw error
  }

  return response.json()
}

function cardSummary(card) {
  return {
    id: card.id,
    name: card.name,
    localId: card.localId,
    image: card.image ? `${card.image}/high.webp` : null,
    thumbnail: card.image ? `${card.image}/low.webp` : null,
  }
}

// Missing prices must stay null: unknown is not the same as a value of zero.
function priceOrNull(value) {
  return Number.isFinite(value) && value >= 0 ? value : null
}

function cardmarketPrices(market) {
  if (!market || market.unit !== 'EUR') return null

  return {
    source: 'Cardmarket',
    currency: 'EUR',
    updatedAt: market.updated ?? null,
    productId: market.idProduct ?? null,
    // Preserve the provider's two price groups; never substitute one for the other.
    trend: priceOrNull(market.trend),
    average: priceOrNull(market.avg),
    low: priceOrNull(market.low),
    trendHolo: priceOrNull(market['trend-holo']),
    averageHolo: priceOrNull(market['avg-holo']),
    lowHolo: priceOrNull(market['low-holo']),
  }
}

/** Get a card by its TCGdex ID, including EUR prices (or null when unavailable). */
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
    // Keep explicit variant IDs for collection entries and future variant selection.
    detailedVariants: (card.variants_detailed ?? []).map((variant) => ({
      id: variant.variantId,
      type: variant.type,
      size: variant.size,
      prices: cardmarketPrices(variant.pricing?.cardmarket),
    })),
  }
}

/** Search summaries only. Call getCard(id) separately to obtain prices. */
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
