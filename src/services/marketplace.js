import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '@/firebase'

export const formatMoney = (cents) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
export function toCents(value) {
  const text = String(value).trim()
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) throw new Error('Enter a valid amount with at most two decimal places.')
  const cents = Math.round(Number(text.replace(',', '.')) * 100)
  if (!Number.isSafeInteger(cents) || cents > 100000000) throw new Error('Amount is too large.')
  return cents
}
function userId() {
  if (!auth.currentUser) throw new Error('Sign in to manage listings.')
  return auth.currentUser.uid
}
export async function listListings(mine = false) {
  const snapshot = await getDocs(query(collection(db, 'listings'), where(mine ? 'sellerId' : 'status', '==', mine ? userId() : 'active')))
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id })).sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}
export async function getListing(id) {
  const snapshot = await getDoc(doc(db, 'listings', id))
  if (!snapshot.exists()) throw new Error('Listing not found or no longer available.')
  return { ...snapshot.data(), id: snapshot.id }
}
export async function uploadPhotos(listingId, files) {
  const uid = userId()
  if (files.length > 4) throw new Error('Choose up to four photos.')
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Use JPG, PNG or WebP photos up to 5 MB each.')
  }
  const uploaded = []
  try {
    for (const file of files) {
      const path = `listingPhotos/${uid}/${listingId}/${crypto.randomUUID()}`
      const object = storageRef(storage, path)
      await uploadBytes(object, file, { contentType: file.type })
      const photo = { path, url: '' }
      uploaded.push(photo)
      photo.url = await getDownloadURL(object)
    }
    return uploaded
  } catch (error) { await discardPhotos(uploaded); throw error }
}
export async function discardPhotos(photos) {
  await Promise.allSettled(photos.map((photo) => deleteObject(storageRef(storage, photo.path))))
}
export async function saveListing(entryId, form, photos, existing = null) {
  const uid = userId()
  const id = `${uid}_${entryId}`
  const priceCents = toCents(form.price)
  const shippingCents = form.delivery === 'pickup' ? 0 : toCents(form.shipping)
  if (!priceCents) throw new Error('Price must be greater than zero.')
  if (!Number.isInteger(form.quantity) || form.quantity < 1) throw new Error('Enter a whole quantity greater than zero.')
  if (!['tracked', 'pickup'].includes(form.delivery)) throw new Error('Choose a delivery method.')
  if (form.description.trim().length > 2000) throw new Error('Description must be under 2,000 characters.')
  const target = doc(db, 'listings', id)
  await runTransaction(db, async (transaction) => {
    const [owned, listing, profile] = await Promise.all([
      transaction.get(doc(db, 'profiles', uid, 'collection', entryId)),
      transaction.get(target), transaction.get(doc(db, 'profiles', uid)),
    ])
    if (!owned.exists() || form.quantity > owned.data().quantity) throw new Error('The quantity exceeds the cards in your collection.')
    if (listing.exists() && listing.data().status === 'active' && !existing) throw new Error('This card already has an active listing. Edit it in My listings.')
    if (existing && (!listing.exists() || listing.data().status !== 'active')) throw new Error('This listing is no longer active.')
    const entry = owned.data()
    transaction.set(target, {
      sellerId: uid, sellerName: (profile.data()?.displayName || 'Collector').slice(0, 100), entryId,
      cardId: entry.cardId, name: entry.name, image: entry.image ?? null,
      setId: entry.setId, setName: entry.setName, localId: entry.localId,
      variant: entry.variant, language: entry.language, condition: entry.condition,
      quantity: form.quantity, priceCents, shippingCents, currency: 'EUR',
      delivery: form.delivery, description: form.description.trim(), photos,
      status: 'active', createdAt: existing ? listing.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp(),
    })
  })
  return id
}
export async function changeListingStatus(id, status) {
  const uid = userId()
  if (!['sold', 'withdrawn'].includes(status)) throw new Error('Invalid listing status.')
  await runTransaction(db, async (transaction) => {
    const target = doc(db, 'listings', id)
    const listing = await transaction.get(target)
    if (!listing.exists() || listing.data().sellerId !== uid || listing.data().status !== 'active') throw new Error('This listing is no longer active.')
    const data = listing.data()
    const entryRef = doc(db, 'profiles', uid, 'collection', data.entryId)
    const entry = await transaction.get(entryRef)
    if (status === 'sold') {
      if (!entry.exists() || entry.data().quantity < data.quantity) throw new Error('Check the quantity in your collection before marking this listing as sold.')
      const remaining = entry.data().quantity - data.quantity
      if (remaining) {
        const trade = entry.data().tradeQuantity
        transaction.update(entryRef, { quantity: remaining, ...(trade == null ? {} : { tradeQuantity: Math.min(trade, remaining), forTrade: trade > 0 }), updatedAt: serverTimestamp() })
      }
      else transaction.delete(entryRef)
    }
    transaction.update(target, { status, updatedAt: serverTimestamp() })
  })
}
