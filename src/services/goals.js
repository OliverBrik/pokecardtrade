import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { getCard, getSet } from './cards'
import { conditions, languages, listEntries } from './collection'
import { goalProgress } from './goal-logic'

function profile() {
  if (!auth.currentUser) throw new Error('Sign in to manage your collection goals.')
  return doc(db, 'profiles', auth.currentUser.uid)
}

function validGoal(goal) {
  return typeof goal?.setId === 'string' && /^[a-zA-Z0-9.-]{1,80}$/.test(goal.setId)
    && typeof goal.setName === 'string' && goal.setName.length > 0 && goal.setName.length <= 100
    && languages.includes(goal.language) && conditions.includes(goal.minimumCondition)
}

export async function listGoals() {
  const snapshot = await getDoc(profile())
  const goals = snapshot.data()?.collectionGoals
  return Array.isArray(goals) ? goals.filter(validGoal).slice(0, 10) : []
}

export async function saveGoal(set, values) {
  const goal = { setId: set?.id, setName: set?.name, language: values?.language, minimumCondition: values?.minimumCondition }
  if (!validGoal(goal)) {
    throw new Error('Choose a set, language and minimum condition.')
  }
  const target = profile()
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(target)
    const saved = snapshot.data()?.collectionGoals
    const existing = Array.isArray(saved) ? saved.filter(validGoal) : []
    const goals = existing.filter(item => item.setId !== goal.setId)
    if (goals.length >= 10) throw new Error('You can keep up to ten active collection goals.')
    tx.set(target, { collectionGoals: [...goals, goal] }, { merge: true })
  })
  return goal
}

export async function removeGoal(setId) {
  const target = profile()
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(target)
    tx.set(target, { collectionGoals: (snapshot.data()?.collectionGoals ?? []).filter(goal => goal.setId !== setId) }, { merge: true })
  })
}

export async function loadGoalContext(setId, { signal } = {}) {
  const [goals, entries, catalogue] = await Promise.all([listGoals(), listEntries(), getSet(setId, { signal })])
  const goal = goals.find(item => item.setId === setId)
  if (!goal) throw new Error('This collection goal no longer exists. Choose a goal from Collection goals.')
  return { goal, catalogue, entries, progress: goalProgress(catalogue.cards, entries, goal) }
}

export async function addGoalWishes(setId) {
  const target = profile()
  const { goal, progress } = await loadGoalContext(setId)
  let added = 0, retained = 0
  try {
    for (let offset = 0; offset < progress.missing.length; offset += 100) {
      const cards = progress.missing.slice(offset, offset + 100)
      const result = await runTransaction(db, async tx => {
        const targets = cards.map(card => doc(db, target.path, 'wishlist', card.id))
        const snapshots = await Promise.all(targets.map(path => tx.get(path)))
        let count = 0
        cards.forEach((card, index) => {
          if (snapshots[index].exists()) return
          tx.set(targets[index], {
            cardId: card.id, name: card.name, image: card.image ?? null, localId: card.localId ?? '',
            setId: goal.setId, setName: goal.setName, variant: '', language: goal.language,
            minimumCondition: goal.minimumCondition, createdAt: serverTimestamp(),
          })
          count++
        })
        return { added: count, retained: cards.length - count }
      })
      added += result.added; retained += result.retained
    }
  } catch (cause) {
    throw new Error(`Added ${added} cards before the wishlist update stopped. Retry safely; existing wishlist preferences are kept.`, { cause })
  }
  return { added, retained }
}

export async function addGoalOwnedCards(setId, selection, values, requestId) {
  const target = profile()
  if (!Array.isArray(selection) || !selection.length || selection.length > 100
    || new Set(selection.map(item => item.cardId)).size !== selection.length) {
    throw new Error('Choose between one and 100 different cards.')
  }
  if (!/^[a-zA-Z0-9-]{20,64}$/.test(requestId ?? '') || !Number.isInteger(values.quantity)
    || values.quantity < 1 || values.quantity > 9999 || !languages.includes(values.language)
    || !conditions.includes(values.condition)) throw new Error('Choose a valid quantity, language and condition.')
  const context = await loadGoalContext(setId)
  if (values.language !== context.goal.language
    || conditions.indexOf(values.condition) > conditions.indexOf(context.goal.minimumCondition)) {
    throw new Error('Choose the goal language and a condition that meets its minimum.')
  }
  const catalogueIds = new Set(context.catalogue.cards.map(card => card.id))
  if (selection.some(item => !catalogueIds.has(item.cardId))) throw new Error('Choose cards from this goal’s set.')
  const details = await Promise.all(selection.map(item => getCard(item.cardId)))
  const records = selection.map((item, index) => {
    const card = details[index]
    if (card.variants?.[item.variant] !== true) throw new Error(`Choose an available variant for ${card.name}.`)
    return { id: `goal_${requestId}_${card.id}`, cardId: card.id, name: card.name, image: card.image ?? null,
      localId: card.localId ?? '', setId: context.goal.setId, setName: context.goal.setName,
      quantity: values.quantity, variant: item.variant, language: values.language, condition: values.condition,
      forTrade: false, tradeQuantity: 0 }
  })
  const missing = new Set(context.progress.missing.map(card => card.id))
  const pending = records.filter(record => missing.has(record.cardId))
  const entries = [...context.entries]
  let added = 0
  try {
    // Collection rules inspect listing reservations. Keep each transaction well
    // below Firestore's cross-document security-rule access limit.
    for (let offset = 0; offset < pending.length; offset += 10) {
      const chunk = pending.slice(offset, offset + 10)
      const result = await runTransaction(db, async tx => {
        const paths = chunk.map(record => doc(db, target.path, 'collection', record.id))
        const snapshots = await Promise.all(paths.map(path => tx.get(path)))
        const created = []
        chunk.forEach(({ id, ...record }, index) => {
          if (snapshots[index].exists()) return
          tx.set(paths[index], { ...record, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
          created.push({ ...record, id })
        })
        return created
      })
      added += result.length; entries.push(...result)
    }
  } catch (cause) {
    const error = new Error(`Added ${added} cards before saving stopped. Your saved cards are kept. Retry to add the remaining cards.`, { cause })
    error.entries = entries
    throw error
  }
  return { added, skipped: records.length - added, entries }
}
