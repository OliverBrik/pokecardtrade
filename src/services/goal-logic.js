const conditions = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']

export function goalProgress(catalogue, entries, goal) {
  const minimum = conditions.indexOf(goal.minimumCondition || 'Damaged')
  const owned = new Set(entries.filter(entry => {
    const condition = conditions.indexOf(entry.condition)
    return Number.isInteger(entry.quantity) && entry.quantity > 0 && condition >= 0 && minimum >= 0
      && condition <= minimum && (!goal.language || entry.language === goal.language)
  }).map(entry => entry.cardId))
  const cards = [...new Map(catalogue.map(card => [card.id, card])).values()]
  const missing = cards.filter(card => !owned.has(card.id))
  const collected = cards.length - missing.length
  return { total: cards.length, collected, missing, percent: cards.length ? Math.floor(collected / cards.length * 100) : 0 }
}

// Count identities once, even if a collector offers multiple copies/variants.
export function goalMatches(matches, progress, goal) {
  const missing = new Set(progress.missing.map(card => card.id))
  return matches.flatMap(match => {
    const receive = match.receive.filter(card => missing.has(card.cardId)
      && (!goal.language || card.language === goal.language)
      && conditions.indexOf(card.condition) >= 0
      && conditions.indexOf(card.condition) <= conditions.indexOf(goal.minimumCondition || 'Damaged'))
    if (!receive.length || !match.give.length) return []
    const fills = new Set(receive.map(card => card.cardId)).size
    return [{ ...match, receive, goalFills: fills }]
  }).sort((a, b) => b.goalFills - a.goalFills || a.uid.localeCompare(b.uid))
}

export function projectedGoal(catalogue, entries, goal, given, received) {
  const remaining = entries.map(entry => ({ ...entry,
    quantity: entry.quantity - given.filter(line => line.entryId === entry.id).reduce((sum, line) => sum + line.quantity, 0),
  }))
  return goalProgress(catalogue, [...remaining, ...received], goal)
}
