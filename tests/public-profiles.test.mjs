import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { calculateBundle } from '../src/services/bundle.js'

const listing = { id: 'seller_a', sellerId: 'seller', status: 'active', name: 'Pikachu', setName: '151', localId: '025', variant: 'normal', language: 'English', condition: 'Near Mint', priceCents: 125, shippingCents: 350, quantity: 4, delivery: 'tracked' }
const lines = () => [{ listing: { ...listing }, quantity: 2 }, { listing: { ...listing, id: 'seller_b', priceCents: 200, shippingCents: 500 }, quantity: 1 }]

test('a bundle charges quantities and one estimated shipment, never shipping per card', () => {
  assert.deepEqual(calculateBundle(lines()), { sellerId: 'seller', delivery: 'tracked', subtotalCents: 450, shippingCents: 500, totalCents: 950, savingCents: 350 })
  const pickup = lines().map(line => ({ ...line, listing: { ...line.listing, delivery: 'pickup' } }))
  assert.equal(calculateBundle(pickup).shippingCents, 0)
})

test('bundles reject invalid stock, duplicates, mixed sellers and mixed delivery', () => {
  for (const quantity of [0, -1, 1.5, 5, NaN]) assert.throws(() => calculateBundle([{ listing, quantity }]))
  for (const change of [{ sellerId: 'other' }, { status: 'sold' }, { delivery: 'pickup' }, { priceCents: -1 }]) {
    const input = lines()
    Object.assign(input[1].listing, change)
    assert.throws(() => calculateBundle(input))
  }
  assert.throws(() => calculateBundle([lines()[0], lines()[0]]))
  assert.throws(() => calculateBundle([]))
  assert.throws(() => calculateBundle(Array(11).fill(lines()[0])))
})

const boundary = `
const auth={currentUser:{uid:'buyer'}}, db={}, records=new Map();
const doc=(base,...parts)=>({path:[base.path,...(parts.length?parts:['message'])].filter(Boolean).join('/')});
const collection=doc;
const serverTimestamp=()=>123;
const snapshot=target=>({id:target.path.split('/').at(-1),exists:()=>records.has(target.path),data:()=>records.get(target.path)});
const getDoc=async target=>snapshot(target);
const runTransaction=async(_db,fn)=>{const writes=[];await fn({
 get:async target=>snapshot(target),set:(target,data)=>writes.push(()=>records.set(target.path,data)),
 update:(target,data)=>writes.push(()=>records.set(target.path,{...records.get(target.path),...data}))
});writes.forEach(fn=>fn())};
const writeBatch=()=>{const writes=[];return {
 set:(target,data,options)=>writes.push(()=>records.set(target.path,options?.merge?{...records.get(target.path),...data}:data)),
 delete:target=>writes.push(()=>records.delete(target.path)),
 commit:async()=>writes.forEach(fn=>fn())
}};
const formatMoney=cents=>'EUR '+(cents/100).toFixed(2);
export {auth,records};
`
const readSource = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/^import .*\r?\n/gm, '')
const source = boundary + await readSource('../src/services/bundle.js') + await readSource('../src/services/inquiries.js') + await readSource('../src/services/profiles.js')
const service = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('bundle requests use current stock and fail atomically when listings change', async () => {
  for (const line of lines()) service.records.set(`listings/${line.listing.id}`, line.listing)
  const id = await service.contactSellerBundle(lines())
  assert.equal(id, 'seller_a_buyer')
  assert.match(service.records.get(`inquiries/${id}/messages/message`).text, /Estimated total: EUR 9.50/)
  assert.equal(service.records.get('listings/seller_a').quantity, 4)
  service.records.delete(`inquiries/${id}/messages/message`)
  service.records.set('listings/seller_b', { ...lines()[1].listing, quantity: 0 })
  await assert.rejects(service.contactSellerBundle(lines()), /quantities/)
  assert.equal(service.records.has(`inquiries/${id}/messages/message`), false)
  service.records.set('listings/seller_b', { ...lines()[1].listing, priceCents: 999 })
  await assert.rejects(service.contactSellerBundle(lines()), /changed/)
})

test('self-purchases and signed-out requests are rejected', async () => {
  service.auth.currentUser = { uid: 'seller' }
  await assert.rejects(service.contactSellerBundle(lines()), /own cards/)
  service.auth.currentUser = null
  await assert.rejects(service.contactSellerBundle(lines()), /Sign in/)
})

test('public profile writes explicitly exclude email and private account fields', async () => {
  service.auth.currentUser = { uid: 'seller' }
  service.records.set('profiles/seller', { email: 'private@example.test', createdAt: 42 })
  await service.saveProfileDetails({ displayName: ' Seller ', location: 'City', bio: 'Cards', email: 'private@example.test', publicProfile: true, collectionPublic: true, tradesPublic: false })
  const published = service.records.get('publicProfiles/seller')
  assert.deepEqual(Object.keys(published).sort(), ['bio', 'collectionPublic', 'displayName', 'location', 'tradesPublic', 'updatedAt'])
  assert.equal(published.displayName, 'Seller')
  assert.equal(service.records.get('profiles/seller').email, 'private@example.test')
  await service.saveProfileDetails({ displayName: 'Seller', location: '', bio: '', publicProfile: false })
  assert.equal(service.records.has('publicProfiles/seller'), false)
  assert.equal(service.records.get('profiles/seller').email, 'private@example.test')
})
