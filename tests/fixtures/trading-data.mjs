// Synthetic data only. No credentials, real profiles or database writes.
export const auth = { currentUser: { uid: 'alice' } }
export const loadGoalContext = async () => { throw new Error('No collection goal in this fixture.') }
const card = { entryId: 'charizard', id: 'charizard', cardId: 'sv03-223', name: 'Charizard ex', image: null, setName: 'Obsidian Flames', localId: '223', variant: 'holo', language: 'English', condition: 'Near Mint', quantity: 2, tradeQuantity: 1, forTrade: true }
const other = { ...card, entryId: 'pikachu', id: 'pikachu', cardId: 'sv03-027', name: 'Pikachu', localId: '027', quantity: 3, condition: 'Lightly Played' }
const match = { uid: 'bob', displayName: 'Bob · Test collector', location: 'Copenhagen', give: [{ ...card, quantity: 1 }], receive: [other] }
let enabled = false
let listener
let messagesListener
const messages = []
const proposals = [{ id: '00000000-0000-4000-8000-000000000002', senderId: 'bob', recipientId: 'alice', participants: ['bob', 'alice'], senderName: match.displayName, recipientName: 'Alice', give: [other], receive: [{ ...card, quantity: 1 }], message: 'Could we exchange these cards at the next card meet?', status: 'pending', completedBy: [] }]
export const tradeQuantity = entry => entry.forTrade ? entry.tradeQuantity ?? entry.quantity : 0
export const listEntries = async kind => kind === 'wishlist' ? [{ cardId: other.cardId }] : [card]
export const getPublicProfile = async () => ({ tradesPublic: true })
export const tradingEnabled = async () => enabled
export const setTradingEnabled = async value => { enabled = value }
export const findTradeMatches = async () => ({ matches: [match], cursor: null })
export function watchTrades(success) { listener = success; success([...proposals]); return () => { listener = null } }
export async function sendTradeProposal(proposal) {
  proposals.unshift({ ...proposal, id: proposal.proposalId, senderId: 'alice', senderName: 'Alice', recipientName: match.displayName, participants: ['alice', 'bob'], give: proposal.give.map(line => ({ ...card, ...line })), receive: proposal.receive.map(line => ({ ...other, ...line })), status: 'pending', completedBy: [] })
  listener?.([...proposals])
  return { id: proposal.proposalId }
}
export async function respondToTrade(id, action) {
  const trade = proposals.find(item => item.id === id)
  if (action === 'complete') trade.completedBy.push('alice')
  else trade.status = { accept: 'accepted', decline: 'declined', cancel: 'cancelled' }[action]
  listener?.([...proposals])
}
export function watchTradeMessages(_id, success) { messagesListener = success; success([...messages]); return () => { messagesListener = null } }
export async function replyToTrade(_id, text) { messages.push({ id: String(messages.length), senderId: 'alice', text }); messagesListener?.([...messages]) }
