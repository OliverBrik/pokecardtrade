import snapshot from '../data/catalogue-snapshot.js'

export function offlineResponse(path) {
  const url = new URL(path, 'https://catalogue.invalid')
  if (url.pathname === '/sets') return snapshot.sets.map(set => ({ ...set, _offline: true }))
  if (url.pathname === '/rarities') return [...new Set(snapshot.cards.map(card => card.rarity).filter(Boolean))].sort()
  if (url.pathname.startsWith('/sets/')) {
    const set = snapshot.sets.find(item => item.id === decodeURIComponent(url.pathname.slice(6)))
    return set ? { ...set, _offline: true, cards: snapshot.cards.filter(card => card.set.id === set.id) } : null
  }
  if (url.pathname.startsWith('/cards/')) return snapshot.cards.find(card => card.id === decodeURIComponent(url.pathname.slice(7))) ?? null
  if (url.pathname !== '/cards') return null
  const field = key => (url.searchParams.get(key) ?? '').replace(/^(eq|like):/, '').toLowerCase()
  const results = snapshot.cards.filter(card => (!field('name') || card.name.toLowerCase().includes(field('name')))
    && (!field('set.id') || card.set.id.toLowerCase() === field('set.id'))
    && (!field('rarity') || card.rarity?.toLowerCase() === field('rarity'))
    && (!field('localId') || card.localId.toLowerCase() === field('localId')))
  const page = Math.max(1, Number(url.searchParams.get('pagination:page')) || 1)
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('pagination:itemsPerPage')) || 20))
  return results.slice((page - 1) * size, page * size)
}
