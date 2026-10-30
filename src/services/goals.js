import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { getSet } from './cards'
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
