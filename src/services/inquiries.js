import { collection, doc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { calculateBundle } from './bundle'
import { formatMoney } from './marketplace'

export async function contactSellerBundle(lines) {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Sign in to request a combined purchase.')
  const estimate = calculateBundle(lines)
  if (uid === estimate.sellerId) throw new Error('You cannot buy your own cards.')
  const id = `${lines[0].listing.id}_${uid}`
  const target = doc(db, 'inquiries', id)
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(target)
    const snapshots = await Promise.all(lines.map(({ listing }) => transaction.get(doc(db, 'listings', listing.id))))
    const current = snapshots.map((snapshot, index) => {
      if (!snapshot.exists()) throw new Error('A listing is no longer available. Refresh the profile.')
      const listing = { ...snapshot.data(), id: snapshot.id }
      const previous = lines[index].listing
      if (['sellerId', 'priceCents', 'shippingCents', 'delivery', 'cardId', 'variant', 'language', 'condition'].some(field => listing[field] !== previous[field])) {
        throw new Error('A listing has changed. Refresh the profile and review your selection.')
      }
      return { listing, quantity: lines[index].quantity }
    })
    const total = calculateBundle(current)
    const text = [
      'Combined purchase request',
      ...current.map(({ listing, quantity }) => `${quantity} × ${listing.name} (${listing.setName}, ${listing.localId}, ${listing.variant}, ${listing.language}, ${listing.condition}) — ${formatMoney(listing.priceCents * quantity)}\nListing: /marketplace/${listing.id}`),
      `Cards: ${formatMoney(total.subtotalCents)}`,
      total.delivery === 'pickup' ? 'Local pickup: no shipping.' : `Proposed combined shipping: ${formatMoney(total.shippingCents)} (highest individual shipping charge).`,
      `Estimated total: ${formatMoney(total.totalCents)}.`,
      'Please confirm availability and the final combined delivery cost. This request does not reserve the cards or complete payment.',
    ].join('\n\n')
    if (text.length > 2000) throw new Error('This request is too long. Select fewer listings.')
    if (!existing.exists()) transaction.set(target, {
      listingId: current[0].listing.id, cardName: current[0].listing.name, buyerId: uid,
      sellerId: total.sellerId, participants: [uid, total.sellerId],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    else transaction.update(target, { updatedAt: serverTimestamp() })
    transaction.set(doc(collection(target, 'messages')), { senderId: uid, text, createdAt: serverTimestamp() })
  })
  return id
}
export async function contactSeller(listing, text) {
  if(!auth.currentUser)throw new Error('Sign in to contact the seller.')
  const uid=auth.currentUser.uid
  if(uid===listing.sellerId)throw new Error('This is your own listing.')
  if(!text.trim()||text.trim().length>2000)throw new Error('Write a message of up to 2,000 characters.')
  const id=`${listing.id}_${uid}`, target=doc(db,'inquiries',id)
  await runTransaction(db,async transaction=>{
    const [existing,current]=await Promise.all([transaction.get(target),transaction.get(doc(db,'listings',listing.id))])
    if(!current.exists()||current.data().status!=='active')throw new Error('This listing is no longer active.')
    if(!existing.exists())transaction.set(target,{listingId:listing.id,cardName:listing.name,buyerId:uid,sellerId:listing.sellerId,participants:[uid,listing.sellerId],createdAt:serverTimestamp(),updatedAt:serverTimestamp()})
    else transaction.update(target,{updatedAt:serverTimestamp()})
    transaction.set(doc(collection(target,'messages')),{senderId:uid,text:text.trim(),createdAt:serverTimestamp()})
  })
  return id
}
export async function listInquiries(){
  if(!auth.currentUser)throw new Error('Sign in to view messages.')
  const snapshot=await getDocs(query(collection(db,'inquiries'),where('participants','array-contains',auth.currentUser.uid)))
  return snapshot.docs.map(item=>({...item.data(),id:item.id})).sort((a,b)=>(b.updatedAt?.toMillis?.()??0)-(a.updatedAt?.toMillis?.()??0))
}
export function watchInquiries(onInquiries,onError){
  if(!auth.currentUser)throw new Error('Sign in to view messages.')
  return onSnapshot(query(collection(db,'inquiries'),where('participants','array-contains',auth.currentUser.uid)),snapshot=>{
    onInquiries(snapshot.docs.map(item=>({...item.data(),id:item.id})).sort((a,b)=>(b.updatedAt?.toMillis?.()??0)-(a.updatedAt?.toMillis?.()??0)))
  },onError)
}
export function watchMessages(id,onMessages,onError){return onSnapshot(query(collection(db,'inquiries',id,'messages'),orderBy('createdAt')),snapshot=>onMessages(snapshot.docs.map(item=>({...item.data(),id:item.id}))),onError)}
export async function reply(id,text){
  if(!auth.currentUser||!text.trim()||text.trim().length>2000)throw new Error('Write a message of up to 2,000 characters.')
  const target=doc(db,'inquiries',id)
  await runTransaction(db,async transaction=>{
    const inquiry=await transaction.get(target)
    if(!inquiry.exists()||!inquiry.data().participants.includes(auth.currentUser.uid))throw new Error('Conversation unavailable.')
    transaction.set(doc(collection(target,'messages')),{senderId:auth.currentUser.uid,text:text.trim(),createdAt:serverTimestamp()})
    transaction.update(target,{updatedAt:serverTimestamp()})
  })
}
