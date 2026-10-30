import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase'

export const conditions = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']
export const languages = ['English', 'Japanese', 'German', 'French', 'Italian', 'Spanish', 'Portuguese', 'Korean', 'Chinese']

function userCollection(kind) {
  if (!auth.currentUser) throw new Error('Sign in to manage your collection.')
  if (!['collection', 'wishlist'].includes(kind)) throw new Error('Invalid collection.')
  return collection(db, 'profiles', auth.currentUser.uid, kind)
}

export function variantsFor(card) {
  return Object.entries(card.variants ?? {}).filter(([, available]) => available === true).map(([variant]) => variant)
}

function validate(values) {
  if (!Number.isInteger(values.quantity) || values.quantity < 1 || values.quantity > 9999) throw new Error('Quantity must be between 1 and 9999.')
  if (!conditions.includes(values.condition) || !languages.includes(values.language)) throw new Error('Choose a valid condition and language.')
  if (typeof values.variant !== 'string' || !values.variant) throw new Error('Choose a card variant.')
}

export function tradeQuantity(entry) {
  return entry.forTrade ? Math.min(entry.quantity, entry.tradeQuantity ?? entry.quantity) : 0
}

function wishlistPreferences(values = {}) {
  const preferences = { variant: values.variant ?? '', language: values.language ?? '', minimumCondition: values.minimumCondition ?? 'Damaged' }
  if (!['', 'normal', 'holo', 'reverse', 'firstEdition', 'wPromo'].includes(preferences.variant)
    || (preferences.language && !languages.includes(preferences.language))
    || !conditions.includes(preferences.minimumCondition)) throw new Error('Choose valid wishlist preferences.')
  return preferences
}

export async function listEntries(kind = 'collection') {
  const snapshot = await getDocs(userCollection(kind))
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }))
}

export async function addOwnedCard(card, values) {
  validate(values)
  await addDoc(userCollection('collection'), {
    cardId: card.id, name: card.name, image: card.image ?? null,
    localId: card.localId ?? '', setId: card.set?.id ?? '', setName: card.set?.name ?? '',
    ...values, forTrade: false, tradeQuantity: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function addWishlistCard(card, preferences = {}) {
  await setDoc(doc(userCollection('wishlist'), card.id), {
    cardId: card.id, name: card.name, image: card.image ?? null,
    localId: card.localId ?? '', setId: card.set?.id ?? '', setName: card.set?.name ?? '',
    ...wishlistPreferences(preferences), createdAt: serverTimestamp(),
  })
}

export async function updateEntry(id, values) {
  validate(values)
  const quantity = values.forTrade ? values.tradeQuantity : 0
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > values.quantity || (values.forTrade && quantity === 0)) throw new Error('Choose a trade quantity between 1 and the number of cards you own.')
  await updateDoc(doc(userCollection('collection'), id), { ...values, tradeQuantity: quantity, forTrade: quantity > 0, updatedAt: serverTimestamp() })
}

export async function updateWishlistEntry(id, values) {
  await updateDoc(doc(userCollection('wishlist'), id), wishlistPreferences(values))
}

export function removeEntry(id, kind = 'collection') {
  return deleteDoc(doc(userCollection(kind), id))
}

export function entryPrice(card, variant) {
  if (!card) return null
  const positive = value => Number.isFinite(value) && value > 0 ? value : null
  if (variant === 'normal') return positive(card.prices?.trend)
  if (['holo', 'reverse'].includes(variant)) {
    const holoPrice = positive(card.prices?.trendHolo)
    if (holoPrice !== null) return holoPrice
    // Holo-only cards (e.g. ex) use the base product's price in Cardmarket.
    // Never use the base price for reverse or for cards with competing printings.
    const holoOnly = card.variants?.holo === true
      && !Object.entries(card.variants).some(([name, available]) => name !== 'holo' && available === true)
    if (variant === 'holo' && holoOnly) return positive(card.prices?.trend)
  }
  return null
}
