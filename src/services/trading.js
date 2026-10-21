import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth, db } from '@/firebase'

function uid() {
  if (!auth.currentUser) throw new Error('Sign in to trade.')
  return auth.currentUser.uid
}

export async function tradingEnabled() {
  return (await getDoc(doc(db, 'tradingMembers', uid()))).data()?.enabled === true
}

export async function setTradingEnabled(enabled) {
  await setDoc(doc(db, 'tradingMembers', uid()), { enabled: enabled === true, updatedAt: serverTimestamp() })
}

async function call(name, data) {
  uid()
  try { return (await httpsCallable(getFunctions(app), name)(data)).data }
  catch (error) {
    if (['functions/not-found', 'functions/unavailable', 'functions/internal'].includes(error.code)) {
      throw new Error('The trading service is unavailable. Please try again later.', { cause: error })
    }
    throw error
  }
}

export const findTradeMatches = cursor => call('findTradeMatches', { cursor: cursor ?? null })
export const sendTradeProposal = proposal => call('sendTradeProposal', proposal)
export const respondToTrade = (id, action) => call('respondToTrade', { id, action })

export function watchTrades(success, failure) {
  return onSnapshot(query(collection(db, 'trades'), where('participants', 'array-contains', uid())), snapshot => {
    success(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)))
  }, failure)
}

export function watchTradeMessages(id, success, failure) {
  uid()
  return onSnapshot(query(collection(db, 'trades', id, 'messages'), orderBy('createdAt')), snapshot => {
    success(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })))
  }, failure)
}

export async function replyToTrade(id, text) {
  const senderId = uid()
  if (!text.trim() || text.trim().length > 2000) throw new Error('Write a message of up to 2,000 characters.')
  await addDoc(collection(db, 'trades', id, 'messages'), { senderId, text: text.trim(), createdAt: serverTimestamp() })
}
