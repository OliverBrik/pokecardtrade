/* Pure matching and validation shared by the callable handlers and their tests. */
const conditions = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']

function available(entry, listing) {
  if (!entry?.forTrade) return 0
  const quantity = entry.tradeQuantity ?? entry.quantity
  if (!Number.isInteger(quantity) || quantity < 0) return 0
  return Math.max(0, Math.min(quantity, entry.quantity - (listing?.status === 'active' ? listing.quantity : 0)))
}

function matchesWish(entry, wish) {
  const actual = conditions.indexOf(entry.condition)
  const minimum = conditions.indexOf(wish.minimumCondition || 'Damaged')
  return entry.cardId === wish.cardId && actual >= 0 && minimum >= 0 && actual <= minimum
    && (!wish.variant || wish.variant === entry.variant)
    && (!wish.language || wish.language === entry.language)
}

function matchingCards(entries, wishes, listings = new Map()) {
  return entries.flatMap(entry => {
    const quantity = available(entry, listings.get(entry.id))
    if (!quantity || !wishes.some(wish => matchesWish(entry, wish))) return []
    // Never return the owner's total inventory, timestamps or unrelated wishes.
    return [{ entryId: entry.id, cardId: entry.cardId, name: entry.name, image: entry.image ?? null,
      setName: entry.setName ?? '', localId: entry.localId ?? '', variant: entry.variant,
      language: entry.language, condition: entry.condition, quantity }]
  })
}

function selectLines(selection, cards) {
  if (!Array.isArray(selection) || !selection.length || selection.length > 10) throw new Error('Choose between one and ten cards on each side.')
  const seen = new Set()
  return selection.map(line => {
    const card = cards.find(item => item.entryId === line.entryId)
    if (!card || seen.has(line.entryId) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > card.quantity) {
      throw new Error('A selected card is no longer available. Refresh your matches.')
    }
    seen.add(line.entryId)
    return { ...card, quantity: line.quantity }
  })
}

function nextState(trade, uid, action) {
  if (!trade.participants.includes(uid)) throw new Error('This proposal is private.')
  if (trade.status === 'pending' && uid === trade.recipientId && ['accept', 'decline'].includes(action)) {
    return { status: action === 'accept' ? 'accepted' : 'declined' }
  }
  if (['pending', 'accepted'].includes(trade.status) && action === 'cancel' && (uid === trade.senderId || trade.status === 'accepted')) return { status: 'cancelled' }
  if (trade.status === 'accepted' && action === 'complete') {
    const completedBy = [...new Set([...(trade.completedBy ?? []), uid])]
    return { completedBy, status: completedBy.length === 2 ? 'completed' : 'accepted' }
  }
  throw new Error('This proposal has changed. Refresh before trying again.')
}

module.exports = { available, matchesWish, matchingCards, selectLines, nextState }
