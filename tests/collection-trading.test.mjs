import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (await readFile(new URL('../src/services/collection.js', import.meta.url), 'utf8')).replace(/^import .*\r?\n/gm, '')
const boundary = `
const auth={currentUser:{uid:'alice'}},db={},records=new Map();
const collection=(_db,...parts)=>({path:parts.join('/')});
const doc=(base,id)=>({path:base.path+'/'+id});
const serverTimestamp=()=>123;
const updateDoc=async(target,values)=>{if(!records.has(target.path))throw new Error('Missing entry');records.set(target.path,{...records.get(target.path),...values})};
const setDoc=async(target,values)=>records.set(target.path,values);
export {auth,records};
`
const service = await import(`data:text/javascript;base64,${Buffer.from(boundary + source).toString('base64')}`)
const ownedPath = 'profiles/alice/collection/card'
const values = { quantity: 4, variant: 'holo', language: 'English', condition: 'Near Mint', forTrade: true, tradeQuantity: 3 }

test('collection updates reject excess/fractional trade copies and preserve the copies kept', async () => {
  service.records.set(ownedPath, { ...values })
  for (const tradeQuantity of [-1, 0, 5, 1.5, '2']) await assert.rejects(service.updateEntry('card', { ...values, tradeQuantity }))
  assert.equal(service.records.get(ownedPath).tradeQuantity, 3)
  await service.updateEntry('card', { ...values, tradeQuantity: 2 })
  assert.equal(service.records.get(ownedPath).quantity - service.records.get(ownedPath).tradeQuantity, 2)
  await service.updateEntry('card', { ...values, forTrade: false })
  assert.equal(service.records.get(ownedPath).tradeQuantity, 0)
  assert.equal(service.tradeQuantity({ quantity: 4, forTrade: true }), 4)
})

test('wishlist preference edits retain card identity and timestamp and reject invalid preferences', async () => {
  const path = 'profiles/alice/wishlist/sv03-223'
  await service.addWishlistCard({ id: 'sv03-223', name: 'Charizard ex' })
  await service.updateWishlistEntry('sv03-223', { variant: 'reverse', language: 'Japanese', minimumCondition: 'Near Mint', name: 'Unwanted change', email: 'private@example.test' })
  assert.equal(service.records.get(path).name, 'Charizard ex')
  assert.equal(service.records.get(path).createdAt, 123)
  assert.equal(service.records.get(path).email, undefined)
  assert.equal(service.records.get(path).variant, 'reverse')
  for (const invalid of [{ variant: 'invented' }, { language: 'invented' }, { minimumCondition: 'Mint+' }]) await assert.rejects(service.updateWishlistEntry('sv03-223', invalid))
  service.auth.currentUser = null
  await assert.rejects(service.updateWishlistEntry('sv03-223', {}), /Sign in/)
})
