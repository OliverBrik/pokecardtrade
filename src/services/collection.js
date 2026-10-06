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

export async function listEntries(kind = 'collection') {
  const snapshot = await getDocs(userCollection(kind))
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }))
}

export async function addOwnedCard(card, values) {
  validate(values)
  await addDoc(userCollection('collection'), {
    cardId: card.id, name: card.name, image: card.image ?? null,
    localId: card.localId ?? '', setId: card.set?.id ?? '', setName: card.set?.name ?? '',
    ...values, forTrade: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function addWishlistCard(card) {
  await setDoc(doc(userCollection('wishlist'), card.id), {
    cardId: card.id, name: card.name, image: card.image ?? null,
    localId: card.localId ?? '', setId: card.set?.id ?? '', setName: card.set?.name ?? '',
    createdAt: serverTimestamp(),
  })
}

export async function updateEntry(id, values) {
  validate(values)
  await updateDoc(doc(userCollection('collection'), id), { ...values, updatedAt: serverTimestamp() })
}

export function removeEntry(id, kind = 'collection') {
  return deleteDoc(doc(userCollection(kind), id))
}

export function entryPrice(card, variant) {
  if (!card) return null
  if (variant === 'normal') return card.prices?.trend ?? null
  // The API groups holo and reverse prices; other printings have no comparable estimate.
  if (['holo', 'reverse'].includes(variant)) return card.prices?.trendHolo ?? null
  return null
}
