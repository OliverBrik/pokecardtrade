import { parse } from '@babel/parser'
import { mkdir, writeFile } from 'node:fs/promises'

const api = 'https://api.github.com/repos/tcgdex/cards-database'
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Source request failed: ${response.status} ${url}`)
  return response.json()
}
const commit = (await json(`${api}/commits/master`)).sha
function literal(node) {
  if (!node) return undefined
  if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)) return node.value
  if (node.type === 'ArrayExpression') return node.elements.map(literal)
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.filter(p => p.type === 'ObjectProperty').map(p => [p.key.name ?? p.key.value, literal(p.value)]))
  return undefined // Never execute source code or resolve imported identifiers.
}
async function source(file, variable) {
  const response = await fetch(file.download_url.replace('/master/', `/${commit}/`), { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Card source failed: ${response.status}`)
  const tree = parse(await response.text(), { sourceType: 'module', plugins: ['typescript'] })
  const declaration = tree.program.body.flatMap(node => node.type === 'VariableDeclaration' ? node.declarations : []).find(node => node.id.name === variable)
  return literal(declaration?.init)
}
const sets = [], cards = []
for (const [name, series] of [['151', 'Scarlet & Violet'], ['Obsidian Flames', 'Scarlet & Violet']]) {
  const directory = `data/${series}/${name}`
  const info = await json(`${api}/contents/${encodeURI(directory)}.ts?ref=${commit}`)
  const metadata = await source(info, 'set')
  const files = (await json(`${api}/contents/${encodeURI(directory)}?ref=${commit}`)).filter(file => /^\d+\.ts$/.test(file.name))
  const set = { id: metadata.id, name: metadata.name.en, cardCount: { official: metadata.cardCount.official, total: files.length } }
  sets.push(set)
  let index = 0
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (index < files.length) {
      const file = files[index++]
      const data = await source(file, 'card')
      if (!data?.name?.en) throw new Error(`Missing English identity: ${file.name}`)
      const localId = file.name.slice(0, -3)
      const available = (data.variants ?? []).filter(variant => !variant.size || variant.size === 'normal').map(variant => variant.type)
      const variants = Object.fromEntries(['normal', 'holo', 'reverse', 'firstEdition', 'wPromo'].map(variant => [variant, available.includes(variant)]))
      cards.push({ id: `${set.id}-${localId}`, name: data.name.en, localId, set,
        image: `https://assets.tcgdex.net/en/sv/${set.id}/${localId}`, rarity: data.rarity ?? null, variants,
        _offline: true, pricing: null })
    }
  }))
  console.log(`Saved ${set.name}: ${files.length} card identities`)
}
cards.sort((a, b) => a.id.localeCompare(b.id))
const root = new URL('../src/data/', import.meta.url)
await mkdir(root, { recursive: true })
const snapshot = { source: 'https://github.com/tcgdex/cards-database', commit, capturedAt: new Date().toISOString(), sets, cards }
await writeFile(new URL('catalogue-snapshot.js', root), `// Official TCGdex metadata, MIT license. No price data is included.\nexport default ${JSON.stringify(snapshot)}\n`)
const license = await fetch(`https://raw.githubusercontent.com/tcgdex/cards-database/${commit}/LICENSE`)
if (!license.ok) throw new Error('Could not retrieve source license')
await writeFile(new URL('TCGdex-LICENSE.txt', root), await license.text())
