// Exercise the real service with an isolated in-memory Firestore/Storage boundary.
// This checks business behaviour; it does not replace Firebase security-rule tests.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const boundary = `
const auth = {currentUser:{uid:'seller'}}, db={}, storage={}, records=new Map(), objects=new Set();
let clock=0, failUrl=false;
const serverTimestamp=()=>({toMillis:()=>++clock});
const collection=(base,...parts)=>({path:[base.path,...parts].filter(Boolean).join('/')});
const doc=(base,...parts)=>({path:[base.path,...(parts.length?parts:['message-'+(++clock)])].filter(Boolean).join('/')});
const snapshot=target=>({id:target.path.split('/').at(-1),exists:()=>records.has(target.path),data:()=>records.get(target.path)});
const getDoc=async target=>snapshot(target);
const where=(key,op,value)=>({key,op,value});
const query=(target,filter)=>({...target,filter});
const getDocs=async target=>({docs:[...records].filter(([path,value])=>path.startsWith(target.path+'/')&&path.split('/').length===target.path.split('/').length+1&&(!target.filter||value[target.filter.key]===target.filter.value)).map(([path])=>snapshot({path}))});
const runTransaction=async(_db,callback)=>{const writes=[];await callback({get:async target=>snapshot(target),set:(target,value)=>writes.push(()=>records.set(target.path,value)),update:(target,value)=>writes.push(()=>records.set(target.path,{...records.get(target.path),...value})),delete:target=>writes.push(()=>records.delete(target.path))});writes.forEach(write=>write());};
const storageRef=(_storage,path)=>({path});
const uploadBytes=async target=>objects.add(target.path);
const getDownloadURL=async target=>{if(failUrl)throw new Error('Download URL failed');return 'https://firebasestorage.googleapis.com/'+target.path};
const deleteObject=async target=>objects.delete(target.path);
const setFailUrl=value=>{failUrl=value};
export {records,objects,auth,setFailUrl};
`
const source = (await readFile(new URL('../src/services/marketplace.js', import.meta.url), 'utf8')).replace(/^import .*\r?\n/gm, '')
const service = await import(`data:text/javascript;base64,${Buffer.from(boundary + source).toString('base64')}`)
const entryPath = 'profiles/seller/collection/entry'
const entry = {cardId:'sv03-223',name:'Charizard ex',image:null,setId:'sv03',setName:'Obsidian Flames',localId:'223',variant:'holo',language:'English',condition:'Near Mint',quantity:3}
const form = {quantity:2,price:'12.34',shipping:'3.50',delivery:'tracked',description:'Actual card condition'}

test('currency inputs preserve cents and reject invalid prices', () => {
  assert.equal(service.toCents('12.34'),1234)
  assert.equal(service.toCents('0,29'),29)
  for(const value of ['-1','1.234','1e3','NaN','','1,2.3','1000001'])assert.throws(()=>service.toCents(value))
})
test('listing quantity, duplicates, editing, withdrawal and sold stock are consistent',async()=>{
  service.records.set(entryPath,{...entry})
  service.records.set('profiles/seller',{displayName:'Seller'})
  await assert.rejects(service.saveListing('entry',{...form,quantity:4},[]),/quantity exceeds/)
  assert.equal(service.records.has('listings/seller_entry'),false)
  const id=await service.saveListing('entry',form,[])
  assert.equal(id,'seller_entry')
  assert.equal(service.records.get('listings/'+id).priceCents,1234)
  await assert.rejects(service.saveListing('entry',form,[]),/already has an active/)
  await service.saveListing('entry',{...form,delivery:'pickup',price:'13'},[],await service.getListing(id))
  assert.equal(service.records.get('listings/'+id).shippingCents,0)
  await service.changeListingStatus(id,'withdrawn')
  assert.equal(service.records.get(entryPath).quantity,3)
  assert.equal((await service.listListings()).length,0)
  await service.saveListing('entry',form,[])
  await service.changeListingStatus(id,'sold')
  assert.equal(service.records.get(entryPath).quantity,1)
  await assert.rejects(service.changeListingStatus(id,'sold'),/no longer active/)
  assert.equal(service.records.get(entryPath).quantity,1)
  await service.saveListing('entry',{...form,quantity:1},[])
  await service.changeListingStatus(id,'sold')
  assert.equal(service.records.has(entryPath),false)
})
test('another user and a signed-out visitor cannot use seller service operations',async()=>{
  service.auth.currentUser={uid:'other'}
  await assert.rejects(service.changeListingStatus('seller_entry','withdrawn'),/no longer active/)
  service.auth.currentUser=null
  await assert.rejects(service.saveListing('entry',form,[]),/Sign in/)
  service.auth.currentUser={uid:'seller'}
})
test('uploads validate file limits and clean up after download URL failure',async()=>{
  await assert.rejects(service.uploadPhotos('seller_entry',[{type:'image/svg+xml',size:1}]),/JPG/)
  await assert.rejects(service.uploadPhotos('seller_entry',[{type:'image/png',size:6*1024*1024}]),/5 MB/)
  service.setFailUrl(true)
  await assert.rejects(service.uploadPhotos('seller_entry',[{type:'image/png',size:100}]),/Download URL failed/)
  assert.equal(service.objects.size,0)
  service.setFailUrl(false)
  const photos=await service.uploadPhotos('seller_entry',[{type:'image/png',size:100}])
  assert.equal(photos.length,1)
  assert.match(photos[0].path,/^listingPhotos\/seller\/seller_entry\//)
  assert.equal(service.objects.size,1)
  await service.discardPhotos(photos)
  assert.equal(service.objects.size,0)
})
