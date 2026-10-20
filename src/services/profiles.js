import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '@/firebase'

export async function getPublicProfile(uid) {
  const snapshot = await getDoc(doc(db, 'publicProfiles', uid))
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null
}

export async function saveProfileDetails(values) {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Sign in to update your profile.')
  const details = {
    displayName: values.displayName.trim(),
    location: values.location.trim(),
    bio: values.bio.trim(),
  }
  if (!details.displayName || details.displayName.length > 100 || details.location.length > 100 || details.bio.length > 280) {
    throw new Error('Use a name and location of up to 100 characters and a bio of up to 280 characters.')
  }
  const batch = writeBatch(db)
  batch.set(doc(db, 'profiles', uid), details, { merge: true })
  if (values.publicProfile) {
    batch.set(doc(db, 'publicProfiles', uid), {
      ...details,
      collectionPublic: values.collectionPublic === true,
      tradesPublic: values.tradesPublic === true,
      updatedAt: serverTimestamp(),
    })
  } else {
    batch.delete(doc(db, 'publicProfiles', uid))
  }
  await batch.commit()
}

export async function listPublicCards(uid, forTrade = false) {
  const target = collection(db, 'profiles', uid, 'collection')
  const snapshot = await getDocs(forTrade ? query(target, where('forTrade', '==', true)) : target)
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }))
}

export async function listSellerListings(uid) {
  const snapshot = await getDocs(query(collection(db, 'listings'), where('status', '==', 'active'), where('sellerId', '==', uid)))
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }))
}
