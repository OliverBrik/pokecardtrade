import { collection, doc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { auth, db } from '@/firebase'
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
