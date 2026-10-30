<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import snapshot from '@/data/catalogue-snapshot'
import { goalProgress, projectedGoal } from '@/services/goal-logic'

const set = snapshot.sets.find(item => item.id === 'sv03.5')
const catalogue = snapshot.cards.filter(card => card.set.id === set.id)
const goal = { language: 'English', minimumCondition: 'Lightly Played' }
const givingIds = ['sv03.5-001', 'sv03.5-004'], receivingIds = ['sv03.5-003', 'sv03.5-009']
const entry = card => ({ id: card.id, entryId: card.id, cardId: card.id, name: card.name, image: card.image + '/high.webp', quantity: givingIds.includes(card.id) ? 2 : 1, language: 'English', condition: 'Near Mint', variant: card.variants.holo ? 'holo' : 'normal' })
function startingCollection() { return catalogue.slice(0, 152).filter(card => !receivingIds.includes(card.id)).map(entry) }
const collection = ref(startingCollection()), stage = ref(0)
const give = givingIds.map(id => ({ ...entry(catalogue.find(card => card.id === id)), quantity: 1 }))
const receive = receivingIds.map(id => ({ ...entry(catalogue.find(card => card.id === id)), quantity: 1 }))
const progress = computed(() => goalProgress(catalogue, collection.value, goal))
const preview = computed(() => projectedGoal(catalogue, collection.value, goal, give, receive))
const starting = goalProgress(catalogue, startingCollection(), goal)
function finish() {
  if (stage.value !== 4) return
  collection.value = [...collection.value.map(card => ({ ...card, quantity: card.quantity - (givingIds.includes(card.id) ? 1 : 0) })), ...receive]
  stage.value = 5
}
function reset() { collection.value = startingCollection(); stage.value = 0 }
</script>

<template>
  <main class="mx-auto min-h-screen max-w-6xl space-y-6 px-6 py-10 text-linen sm:px-8">
    <aside class="rounded-xl border border-apricot/40 bg-panel p-4 text-sm leading-6"><strong class="text-apricot">INTERACTIVE DEMO</strong> · Fictional collectors and ownership. Real card identities from the bundled TCGdex catalogue. All actions stay in this page; no accounts, messages or inventories are changed. Images need internet. No live prices are shown.</aside>
    <header><p class="text-xs font-bold tracking-widest text-mint">COLLECT TOGETHER</p><h1 class="display-font mt-3 text-4xl font-bold">Your duplicates.<br /><span class="text-apricot">Someone else’s missing cards.</span></h1><p class="mt-4 max-w-2xl text-linen/65">Try the complete set → match → proposal → exchange journey, even while the live catalogue or trading server is unavailable.</p></header>
    <section class="rounded-2xl border border-mint/30 bg-panel p-6"><h2 class="display-font text-2xl font-bold">Your goal: complete {{ set.name }}</h2><p class="mt-3 text-3xl font-bold text-mint">{{ progress.collected }} / {{ progress.total }} · {{ progress.percent }}%</p><progress :value="progress.collected" :max="progress.total" aria-label="Demo set completion" class="mt-4 h-3 w-full accent-mint" /><p class="mt-3 text-sm text-linen/60">One copy per card number. Your collection has spare Bulbasaur and Charmander copies; keep one of each when trading.</p></section>
    <section v-if="stage === 0" class="rounded-2xl bg-panel p-6"><h2 class="display-font text-xl font-bold">1. Find someone who can fill your gaps</h2><p class="mt-3 text-sm text-linen/65">Venusaur ex and Blastoise ex are missing from this fictional collection.</p><button class="market-button mt-5" @click="stage = 1">Find a demo match →</button></section>
    <section v-else class="rounded-2xl border border-linen/15 bg-panel p-6">
      <h2 class="display-font text-2xl font-bold">{{ stage === 5 ? 'Exchange complete' : 'A match in both directions' }}</h2><p class="mt-3 text-sm leading-6 text-linen/65">Alex · fictional collector · has 2 missing card numbers and wants 2 of your spare copies.</p>
      <div class="mt-6 grid gap-5 sm:grid-cols-2"><div v-for="side in [{ title: 'You give · keep one copy of each', cards: give }, { title: 'You receive · fill two gaps', cards: receive }]" :key="side.title"><h3 class="font-bold text-mint">{{ side.title }}</h3><ul class="mt-3 space-y-3"><li v-for="card in side.cards" :key="card.id" class="flex items-center gap-3 rounded-xl bg-ink/50 p-3"><img :src="card.image" :alt="card.name" class="h-24 w-16 object-contain" /><div><p class="font-bold">{{ card.name }}</p><p class="mt-2 text-xs text-linen/60">1 copy · {{ card.variant }} · English · Near Mint</p></div></li></ul></div></div>
      <p v-if="stage < 5" class="mt-6 rounded-xl bg-mint/10 p-4 text-sm text-mint">If completed: {{ progress.collected }} → {{ preview.collected }} collected · {{ progress.percent }}% → {{ preview.percent }}%. Your last copies stay in your collection.</p>
      <button v-if="stage === 1" class="market-button mt-5" @click="stage = 2">Build demo proposal →</button>
      <div v-if="stage === 2" class="mt-5"><p class="text-sm text-linen/65">Demo message: “Would you like to exchange these at our next card meet?”</p><button class="market-button mt-4" @click="stage = 3">Send demo proposal →</button></div>
      <div v-if="stage === 3" class="mt-5"><p role="status" class="text-sm text-mint">Demo proposal sent. Waiting for Alex.</p><button class="market-button mt-4" @click="stage = 4">Simulate Alex accepting and confirming →</button></div>
      <div v-if="stage === 4" class="mt-5"><p role="status" class="text-sm text-mint">Alex accepted and confirmed the fictional exchange. Your confirmation is still needed.</p><button class="market-button mt-4" @click="finish">Confirm received and update demo collection →</button></div>
      <div v-if="stage === 5" role="status" class="mt-5 rounded-xl bg-mint/10 p-5 text-mint"><p class="font-bold">Two gaps filled. Two collectors closer to a complete set.</p><p class="mt-2 text-sm">{{ starting.collected }} → {{ progress.collected }} collected. You kept one Bulbasaur and one Charmander. Only this demo collection was updated.</p></div>
    </section>
    <footer class="flex flex-wrap gap-5"><button class="text-sm text-apricot underline" @click="reset">Reset demo</button><RouterLink to="/goals" class="text-sm text-mint underline">Open my real collection goals →</RouterLink><RouterLink to="/" class="text-sm text-linen/65 underline">Browse catalogue →</RouterLink></footer>
  </main>
</template>
