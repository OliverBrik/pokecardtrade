import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { goalMatches, goalProgress, projectedGoal } from '../src/services/goal-logic.js'

const catalogue = ['a', 'b', 'c'].map(id => ({ id, name: id, localId: id }))
const goal = { setId: 'set', setName: 'Test set', language: 'English', minimumCondition: 'Lightly Played' }
const card = { id: 'owned', cardId: 'a', variant: 'normal', language: 'English', condition: 'Near Mint', quantity: 1 }

test('set completion counts unique card identities, never duplicates, unrelated cards or wrong preferences', () => {
  const entries = [card, { ...card, id: 'holo', variant: 'holo', quantity: 4 },
    { ...card, cardId: 'b', language: 'Japanese' }, { ...card, cardId: 'c', condition: 'Damaged' },
    { ...card, cardId: 'unrelated' }, { ...card, cardId: 'b', quantity: 0 }]
  const result = goalProgress([...catalogue, catalogue[0]], entries, goal)
  assert.deepEqual({ total: result.total, collected: result.collected, percent: result.percent }, { total: 3, collected: 1, percent: 33 })
  assert.deepEqual(result.missing.map(item => item.id), ['b', 'c'])
  assert.equal(goalProgress(catalogue, catalogue.map(item => ({ ...card, cardId: item.id })), goal).percent, 100)
  assert.equal(goalProgress([], entries, goal).percent, 0)
})

test('goal matches rank distinct missing identities and retain reciprocal and preference requirements', () => {
  const receive = (cardId, overrides = {}) => ({ ...card, cardId, ...overrides })
  const matches = [
    { uid: 'one', give: [card], receive: [receive('b'), receive('b', { variant: 'holo' }), receive('a')] },
    { uid: 'two', give: [card], receive: [receive('b'), receive('c')] },
    { uid: 'no-give', give: [], receive: [receive('b')] },
    { uid: 'wrong-preferences', give: [card], receive: [receive('b', { language: 'Japanese' }), receive('c', { condition: 'Damaged' })] },
  ]
  const result = goalMatches(matches, goalProgress(catalogue, [card], goal), goal)
  assert.deepEqual(result.map(item => [item.uid, item.goalFills]), [['two', 2], ['one', 1]])
  assert.equal(result[1].receive.length, 2)
  assert.equal(matches[0].receive.length, 3) // Do not mutate the original match results.
})

test('trade projection subtracts outgoing last copies and counts incoming identities only once', () => {
  const incoming = [{ ...card, cardId: 'b', quantity: 5 }]
  assert.equal(projectedGoal(catalogue, [card], goal, [{ entryId: 'owned', quantity: 1 }], incoming).collected, 1)
  assert.equal(projectedGoal(catalogue, [{ ...card, quantity: 2 }], goal, [{ entryId: 'owned', quantity: 1 }], incoming).collected, 2)
  assert.equal(projectedGoal(catalogue, [card], goal, [], [{ ...card, cardId: 'b', language: 'Japanese' }]).collected, 1)
})

const source = (await readFile(new URL('../src/services/goals.js', import.meta.url), 'utf8')).replace(/^import .*\r?\n/gm, '')
const boundary = `
const auth={currentUser:{uid:'alice'}}, db={}, records=new Map();
let owned=[], catalogueCards=[], failCommit=0, commits=0;
const doc=(_db,...parts)=>({path:parts.join('/')});
const snapshot=path=>({exists:()=>records.has(path),data:()=>records.get(path)});
const getDoc=async target=>snapshot(target.path);
const conditions=['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'];
const languages=['English','Japanese'];
const listEntries=async()=>owned;
const getSet=async id=>({id,name:'Test set',cards:catalogueCards});
const serverTimestamp=()=>123;
const runTransaction=async(_db,callback)=>{
  const writes=[];
  const result=await callback({get:async target=>snapshot(target.path),set:(target,value,options)=>writes.push(()=>records.set(target.path,options?.merge?{...records.get(target.path),...value}:value))});
  commits++; if(commits===failCommit)throw new Error('Simulated failure');
  writes.forEach(write=>write()); return result;
};
const goalProgress=${goalProgress.toString()};
export {records,auth};
export function reset(cards,entries=[],failure=0){records.clear();owned=entries;catalogueCards=cards;commits=0;failCommit=failure;auth.currentUser={uid:'alice'};}
`
const service = await import(`data:text/javascript;base64,${Buffer.from(boundary + source).toString('base64')}`)

test('goals persist only on the private profile and retain account fields and other goals', async () => {
  service.reset(catalogue)
  service.records.set('profiles/alice', { email: 'private@example.test' })
  await service.saveGoal({ id: 'set', name: 'Test set' }, goal)
  await service.saveGoal({ id: 'other', name: 'Other set' }, goal)
  await service.saveGoal({ id: 'set', name: 'Test set' }, { ...goal, minimumCondition: 'Near Mint' })
  assert.equal((await service.listGoals()).length, 2)
  assert.equal(service.records.get('profiles/alice').email, 'private@example.test')
  assert.equal(service.records.has('publicProfiles/alice'), false)
  await service.removeGoal('set')
  assert.deepEqual((await service.listGoals()).map(item => item.setId), ['other'])
  for (const language of ['Unknown', '']) await assert.rejects(service.saveGoal({ id: 'set', name: 'Set' }, { ...goal, language }))
  service.auth.currentUser = null
  await assert.rejects(service.listGoals(), /Sign in/)
})

test('goal limit permits editing an existing goal and prevents adding an eleventh', async () => {
  service.reset(catalogue)
  for (let index = 0; index < 10; index++) await service.saveGoal({ id: 'set-' + index, name: 'Set ' + index }, goal)
  await service.saveGoal({ id: 'set-0', name: 'Set zero' }, goal)
  await assert.rejects(service.saveGoal({ id: 'eleventh', name: 'Eleventh' }, goal), /up to ten/)
  assert.equal((await service.listGoals()).length, 10)
})

test('bulk goal wishes omit owned cards and preserve existing preferences and timestamps', async () => {
  service.reset(catalogue, [card])
  await service.saveGoal({ id: 'set', name: 'Test set' }, goal)
  const existing = { cardId: 'b', variant: 'reverse', language: 'Japanese', minimumCondition: 'Near Mint', createdAt: 42 }
  service.records.set('profiles/alice/wishlist/b', existing)
  assert.deepEqual(await service.addGoalWishes('set'), { added: 1, retained: 1 })
  assert.equal(service.records.has('profiles/alice/wishlist/a'), false)
  assert.deepEqual(service.records.get('profiles/alice/wishlist/b'), existing)
  assert.equal(service.records.get('profiles/alice/wishlist/c').language, 'English')
  assert.equal(service.records.get('profiles/alice/wishlist/c').minimumCondition, 'Lightly Played')
  assert.deepEqual(await service.addGoalWishes('set'), { added: 0, retained: 2 })
  await service.removeGoal('set')
  assert.equal(service.records.has('profiles/alice/wishlist/c'), true)
  await assert.rejects(service.addGoalWishes('set'), /no longer exists/)
})

test('partial bulk failure reports completed work and a retry safely completes the remaining chunks', async () => {
  const cards = Array.from({ length: 205 }, (_, index) => ({ id: String(index), name: 'Card ' + index }))
  service.reset(cards, [], 3) // Save goal, commit first chunk, reject second chunk.
  await service.saveGoal({ id: 'set', name: 'Test set' }, goal)
  await assert.rejects(service.addGoalWishes('set'), /Added 100 cards/)
  assert.equal([...service.records.keys()].filter(path => path.includes('/wishlist/')).length, 100)
  assert.deepEqual(await service.addGoalWishes('set'), { added: 105, retained: 100 })
})

const cardsSource = await readFile(new URL('../src/services/cards.js', import.meta.url), 'utf8')
const cardsService = await import(`data:text/javascript;base64,${Buffer.from(`
let payload, url;
const fetch=async target=>{url=target;return {ok:true,json:async()=>payload}};
export function fixture(value){payload=value;}
export function requestedUrl(){return url;}
` + cardsSource).toString('base64')}`)

test('set catalogue uses the complete checklist and rejects incomplete data instead of reporting false progress', async () => {
  cardsService.fixture({ id: 'set', name: 'Test set', cardCount: { total: 3 }, cards: catalogue })
  assert.equal((await cardsService.getSet('set')).cards.length, 3)
  assert.equal(cardsService.requestedUrl(), 'https://api.tcgdex.net/v2/en/sets/set')
  cardsService.fixture({ id: 'set', name: 'Test set', cardCount: { total: 4 }, cards: catalogue })
  await assert.rejects(cardsService.getSet('set'), /incomplete/)
  cardsService.fixture({ id: 'different-set', cards: catalogue })
  await assert.rejects(cardsService.getSet('set'), /usable card checklist/)
  await assert.rejects(cardsService.getSet('../invalid'), /valid set/)
})
