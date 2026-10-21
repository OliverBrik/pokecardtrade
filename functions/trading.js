const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore')
const { matchingCards, selectLines, available, nextState } = require('./trade-logic')

function user(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to trade.')
  return request.auth.uid
}

async function participant(uid) {
  const db = getFirestore()
  const [member, profile, cards, wishes, listings] = await Promise.all([
    db.doc(`tradingMembers/${uid}`).get(), db.doc(`publicProfiles/${uid}`).get(),
    db.collection(`profiles/${uid}/collection`).get(), db.collection(`profiles/${uid}/wishlist`).get(),
    db.collection('listings').where('sellerId', '==', uid).get(),
  ])
  const published = profile.data()
  return {
    enabled: member.data()?.enabled === true && !!published && (published.collectionPublic || published.tradesPublic),
    profile: { uid, displayName: published?.displayName || 'Collector', location: published?.location || '' },
    cards: cards.docs.map(doc => ({ ...doc.data(), id: doc.id })),
    wishes: wishes.docs.map(doc => doc.data()),
    listings: new Map(listings.docs.map(doc => [doc.data().entryId, doc.data()])),
  }
}

exports.findTradeMatches = onCall(async request => {
  const uid = user(request)
  const own = await participant(uid)
  if (!own.enabled) throw new HttpsError('failed-precondition', 'Enable matching and share your trade cards through your public profile first.')
  const cursor = request.data?.cursor
  if (cursor != null && (typeof cursor !== 'string' || cursor.length > 128)) throw new HttpsError('invalid-argument', 'Invalid page.')
  const db = getFirestore()
  let query = db.collection('tradingMembers').where('enabled', '==', true).orderBy(FieldPath.documentId())
  if (cursor) query = query.startAfter(cursor)
  const page = await query.limit(11).get()
  const members = page.docs.slice(0, 10)
  const matches = []
  // Bound each request and avoid an unbounded fan-out of collection reads.
  for (const member of members) {
    if (member.id === uid) continue
    const other = await participant(member.id)
    if (!other.enabled) continue
    const receive = matchingCards(other.cards, own.wishes, other.listings)
    const give = matchingCards(own.cards, other.wishes, own.listings)
    if (receive.length && give.length) matches.push({ ...other.profile, receive, give })
  }
  return { matches, cursor: page.size > 10 ? members.at(-1).id : null }
})

exports.sendTradeProposal = onCall(async request => {
  const uid = user(request)
  const { recipientId, give, receive, message = '', proposalId } = request.data ?? {}
  if (typeof recipientId !== 'string' || !recipientId || recipientId.length > 128 || recipientId.includes('/') || recipientId === uid
    || typeof proposalId !== 'string' || !/^[a-zA-Z0-9-]{20,64}$/.test(proposalId)
    || typeof message !== 'string' || message.length > 1000) throw new HttpsError('invalid-argument', 'Choose another collector and a message of up to 1,000 characters.')
  const [own, other] = await Promise.all([participant(uid), participant(recipientId)])
  if (!own.enabled || !other.enabled) throw new HttpsError('failed-precondition', 'Both collectors must still participate in matching.')
  let giving, receiving
  try {
    giving = selectLines(give, matchingCards(own.cards, other.wishes, own.listings))
    receiving = selectLines(receive, matchingCards(other.cards, own.wishes, other.listings))
  } catch (error) { throw new HttpsError('failed-precondition', error.message) }
  const db = getFirestore()
  const target = db.doc(`trades/${proposalId}`)
  await db.runTransaction(async tx => {
    const existing = await tx.get(target)
    if (existing.exists) {
      if (existing.data().senderId !== uid) throw new HttpsError('already-exists', 'Please refresh and try again.')
      return // Retrying a request cannot create duplicate proposals.
    }
    for (const participantId of [uid, recipientId]) {
      const [member, profile] = await Promise.all([tx.get(db.doc(`tradingMembers/${participantId}`)), tx.get(db.doc(`publicProfiles/${participantId}`))])
      if (!member.data()?.enabled || !(profile.data()?.collectionPublic || profile.data()?.tradesPublic)) {
        throw new HttpsError('failed-precondition', 'Both collectors must still participate in matching.')
      }
    }
    await checkStock(tx, uid, giving)
    await checkStock(tx, recipientId, receiving)
    tx.set(target, { senderId: uid, recipientId, participants: [uid, recipientId],
      senderName: own.profile.displayName, recipientName: other.profile.displayName,
      give: giving, receive: receiving, message: message.trim(), status: 'pending', completedBy: [],
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  })
  return { id: target.id }
})

async function checkStock(tx, uid, lines) {
  const db = getFirestore()
  for (const line of lines) {
    const [entry, listing] = await Promise.all([
      tx.get(db.doc(`profiles/${uid}/collection/${line.entryId}`)), tx.get(db.doc(`listings/${uid}_${line.entryId}`)),
    ])
    const data = entry.data()
    if (!entry.exists || available(data, listing.data()) < line.quantity
      || ['cardId', 'variant', 'language', 'condition'].some(field => data[field] !== line[field])) {
      throw new HttpsError('failed-precondition', 'A proposed card has changed or is no longer available.')
    }
  }
}

exports.respondToTrade = onCall(async request => {
  const uid = user(request)
  const { id, action } = request.data ?? {}
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{20,64}$/.test(id)) throw new HttpsError('invalid-argument', 'Invalid proposal.')
  const db = getFirestore()
  await db.runTransaction(async tx => {
    const target = db.doc(`trades/${id}`)
    const snapshot = await tx.get(target)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Proposal not found.')
    const trade = snapshot.data()
    let change
    try { change = nextState(trade, uid, action) }
    catch (error) { throw new HttpsError('failed-precondition', error.message) }
    if (action === 'accept') {
      await checkStock(tx, trade.senderId, trade.give)
      await checkStock(tx, trade.recipientId, trade.receive)
    }
    tx.update(target, { ...change, updatedAt: FieldValue.serverTimestamp() })
  })
  return { ok: true }
})
