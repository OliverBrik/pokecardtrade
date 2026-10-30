<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSet, getSets } from '@/services/cards'
import { conditions, languages, listEntries } from '@/services/collection'
import { addGoalWishes, listGoals, removeGoal, saveGoal } from '@/services/goals'
import { goalProgress } from '@/services/goal-logic'

const sets = ref([]), goals = ref([]), contexts = ref({}), failures = ref({})
const loading = ref(true), busy = ref(false), error = ref(''), notice = ref('')
const query = ref(''), setId = ref(''), language = ref('English'), minimumCondition = ref('Damaged')
const filter = ref('missing'), page = ref(1), confirming = ref('')
const selected = ref('')
const context = computed(() => contexts.value[selected.value])
const matchingSets = computed(() => sets.value.filter(set => `${set.name} ${set.id}`.toLowerCase().includes(query.value.toLowerCase())))
const checklist = computed(() => {
  if (!context.value) return []
  const missing = new Set(context.value.progress.missing.map(card => card.id))
  return context.value.catalogue.cards.filter(card => filter.value === 'all' || missing.has(card.id))
    .map(card => ({ ...card, missing: missing.has(card.id) }))
})
const visible = computed(() => checklist.value.slice(0, page.value * 30))
let controller, disposed = false

async function load() {
  controller?.abort(); controller = new AbortController()
  const current = controller
  loading.value = true; error.value = ''
  try {
    const [saved, entries] = await Promise.all([listGoals(), listEntries()])
    if (disposed || current.signal.aborted) return
    goals.value = saved; contexts.value = {}; failures.value = {}
    if (!saved.some(goal => goal.setId === selected.value)) selected.value = saved[0]?.setId ?? ''
    await Promise.all(saved.map(async goal => {
      try {
        const catalogue = await getSet(goal.setId, { signal: current.signal })
        const result = { goal, entries, catalogue, progress: goalProgress(catalogue.cards, entries, goal) }
        if (!disposed && !current.signal.aborted) contexts.value[goal.setId] = result
      } catch (cause) {
        if (!disposed && !current.signal.aborted) failures.value[goal.setId] = cause.message || 'Could not load this checklist.'
      }
    }))
  } catch (cause) { if (!disposed && !current.signal.aborted) error.value = cause.message || 'Could not load collection goals.' }
  finally { if (!disposed && !current.signal.aborted) loading.value = false }
}

async function create() {
  busy.value = true; error.value = notice.value = ''
  try {
    const set = sets.value.find(item => item.id === setId.value)
    await saveGoal(set, { language: language.value, minimumCondition: minimumCondition.value })
    selected.value = set.id; page.value = 1
    await load(); notice.value = 'Collection goal saved. Your progress follows the cards in your collection.'
  } catch (cause) { error.value = cause.message || 'Could not save your goal.' }
  finally { busy.value = false }
}

async function wishlist() {
  busy.value = true; error.value = notice.value = ''
  try {
    const result = await addGoalWishes(selected.value)
    notice.value = `Added ${result.added} missing cards to your wishlist. ${result.retained} existing wishlist entries were kept with their original preferences.`
  } catch (cause) { error.value = cause.message || 'Could not update your wishlist.' }
  finally { busy.value = false }
}

async function remove(id) {
  busy.value = true; error.value = notice.value = ''
  try { await removeGoal(id); confirming.value = ''; await load(); notice.value = 'Goal removed. Your collection and wishlist were kept.' }
  catch (cause) { error.value = cause.message || 'Could not remove your goal.' }
  finally { busy.value = false }
}

function select(goal) {
  selected.value = goal.setId; page.value = 1; filter.value = 'missing'; notice.value = ''
}

onMounted(() => {
  load()
  getSets().then(result => { if (!disposed) sets.value = [...result].sort((a, b) => a.name.localeCompare(b.name)) })
    .catch(() => { if (!disposed) error.value = 'Could not load the set catalogue. Reload this page to try again.' })
})
onBeforeUnmount(() => { disposed = true; controller?.abort() })
</script>

<template>
  <main class="mx-auto min-h-[calc(100vh-86px)] max-w-[1440px] space-y-7 px-6 py-10 text-linen sm:px-8 lg:px-16">
    <header class="flex flex-wrap items-end justify-between gap-5">
      <div><p class="text-xs font-bold tracking-widest text-mint">COLLECT TOGETHER</p><h1 class="display-font mt-2 text-4xl font-bold sm:text-5xl">Every gap.<br /><span class="text-apricot">A reason to trade.</span></h1><p class="mt-4 max-w-2xl text-linen/65">Choose a set to complete. Turn missing cards into wishes, and your spare copies into someone else’s next find.</p></div>
      <RouterLink to="/my-collection" class="rounded-xl border border-linen/20 px-5 py-3 text-sm font-bold hover:border-apricot">Manage my collection →</RouterLink>
    </header>
    <p v-if="error" role="alert" class="rounded-xl border border-red-200/30 bg-panel p-4 text-sm text-red-200">{{ error }} <button :disabled="busy || loading" class="ml-2 underline" @click="load">Retry goals</button></p>
    <p v-if="notice" role="status" class="rounded-xl bg-mint/10 p-4 text-sm text-mint">{{ notice }}</p>

    <section aria-labelledby="goal-form-title" class="rounded-2xl border border-linen/15 bg-panel p-5 sm:p-6">
      <h2 id="goal-form-title" class="display-font text-xl font-bold">What would you love to finish?</h2>
      <p class="mt-2 text-sm leading-6 text-linen/60">One copy of every card number, including secret cards. Any variant counts; this is a card checklist, not a variant master set. Goals stay private.</p>
      <form class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="create">
        <label class="text-sm">Find a set<input v-model="query" type="search" placeholder="Search set names…" class="market-field mt-2" @input="setId = ''" /></label>
        <label class="text-sm">Set<select v-model="setId" required class="market-field mt-2"><option value="" disabled>{{ sets.length ? 'Choose a set' : 'Loading sets…' }}</option><option v-for="set in matchingSets" :key="set.id" :value="set.id">{{ set.name }} · {{ set.id }}</option></select></label>
        <label class="text-sm">Language<select v-model="language" class="market-field mt-2"><option v-for="value in languages" :key="value">{{ value }}</option></select></label>
        <label class="text-sm">Minimum condition<select v-model="minimumCondition" class="market-field mt-2"><option v-for="value in conditions" :key="value">{{ value }}</option></select></label>
        <p class="text-xs leading-5 text-linen/55 sm:col-span-2 lg:col-span-3">Save up to 10 sets. Saving an existing set updates its preferences. The checklist uses the English TCGdex catalogue; changing language counts that language’s copies of these card identities, not a different regional set.</p>
        <button type="submit" :disabled="busy || loading || !setId" class="rounded-xl bg-apricot px-5 py-3 text-sm font-bold text-ink disabled:opacity-50">{{ busy ? 'Saving…' : 'Save collection goal' }}</button>
      </form>
    </section>

    <p v-if="loading" role="status" class="py-8 text-center text-linen/60">Loading your collection goals…</p>
    <section v-else-if="!goals.length" class="rounded-2xl border border-dashed border-linen/20 p-10 text-center"><h2 class="display-font text-xl font-bold">Your next complete set starts here</h2><p class="mt-3 text-sm text-linen/60">Choose your first set above. Cards already in your collection count automatically.</p></section>
    <section v-else aria-label="Saved collection goals" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article v-for="goal in goals" :key="goal.setId" class="min-w-0 rounded-2xl border bg-panel p-5" :class="selected === goal.setId ? 'border-apricot' : 'border-linen/15'">
        <button :aria-pressed="selected === goal.setId" class="w-full text-left" @click="select(goal)"><h2 class="display-font text-xl font-bold">{{ goal.setName }}</h2><p class="mt-2 text-xs text-linen/60">{{ goal.language }} · {{ goal.minimumCondition }} or better</p><template v-if="contexts[goal.setId]"><p class="mt-4 text-3xl font-bold text-mint">{{ contexts[goal.setId].progress.percent }}%</p><progress :value="contexts[goal.setId].progress.collected" :max="contexts[goal.setId].progress.total" :aria-label="`${goal.setName} completion`" class="mt-3 h-2 w-full accent-mint" /><p class="mt-3 text-sm text-linen/65">{{ contexts[goal.setId].progress.collected }} / {{ contexts[goal.setId].progress.total }} collected · {{ contexts[goal.setId].progress.missing.length }} missing</p></template><p v-else role="alert" class="mt-4 text-sm text-red-200">{{ failures[goal.setId] || 'Checklist unavailable.' }}</p></button>
        <button v-if="confirming !== goal.setId" :disabled="busy" class="mt-4 text-xs text-linen/55 underline" @click="confirming = goal.setId">Remove goal</button>
        <div v-else class="mt-4 flex flex-wrap gap-4 text-sm"><button :disabled="busy" class="text-red-200 underline" @click="remove(goal.setId)">Confirm removal</button><button :disabled="busy" class="underline" @click="confirming = ''">Keep goal</button></div>
      </article>
    </section>

    <section v-if="!loading && context" aria-labelledby="checklist-title" class="space-y-5">
      <header class="flex flex-wrap items-start justify-between gap-4"><div><h2 id="checklist-title" class="display-font text-2xl font-bold">{{ context.goal.setName }} checklist</h2><p class="mt-2 max-w-2xl text-sm leading-6 text-linen/60">Add missing cards to your wishlist before finding matches. Existing wishlist variant, language and condition preferences are kept; <RouterLink to="/my-collection?tab=wishlist" class="text-apricot underline">review them here</RouterLink>. Adding a card to your collection updates progress when you return.</p></div><button :disabled="busy" class="rounded-xl border border-linen/20 px-4 py-3 text-sm" @click="load">Refresh progress</button></header>
      <div class="flex flex-wrap gap-3"><button :disabled="busy || !context.progress.missing.length" class="rounded-xl bg-apricot px-5 py-3 text-sm font-bold text-ink disabled:opacity-50" @click="wishlist">{{ busy ? 'Updating…' : 'Add missing cards to wishlist' }}</button><RouterLink :to="{ path: '/trading', query: { goal: context.goal.setId } }" class="rounded-xl border border-mint/50 px-5 py-3 text-sm font-bold text-mint">Find trades for this goal →</RouterLink><RouterLink to="/my-collection?tab=trade" class="rounded-xl border border-linen/20 px-5 py-3 text-sm">Choose copies to offer →</RouterLink></div>
      <p v-if="!context.progress.missing.length" role="status" class="rounded-xl bg-mint/10 p-5 text-mint">Set complete. Every card number is in your collection!</p>
      <div class="flex flex-wrap gap-3"><button v-for="item in ['missing', 'all']" :key="item" :aria-pressed="filter === item" class="rounded-lg border px-4 py-2 text-sm capitalize" :class="filter === item ? 'border-apricot text-apricot' : 'border-linen/20'" @click="filter = item; page = 1">{{ item === 'missing' ? 'Missing cards' : 'All cards' }}</button></div>
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><li v-for="card in visible" :key="card.id" class="flex min-w-0 items-center gap-3 rounded-xl border border-linen/10 bg-panel p-3"><img v-if="card.thumbnail" :src="card.thumbnail" :alt="card.name" loading="lazy" class="h-20 w-14 shrink-0 object-contain" /><div class="min-w-0"><p class="break-words font-bold">{{ card.name }}</p><p class="mt-1 text-xs text-linen/55">#{{ card.localId }} · {{ card.missing ? 'Missing' : 'Collected' }}</p><RouterLink v-if="card.missing" :to="{ path: '/my-collection', query: { add: card.id } }" class="mt-2 inline-block text-xs text-apricot underline">I own this card →</RouterLink></div></li></ul>
      <button v-if="visible.length < checklist.length" class="rounded-xl border border-linen/20 px-5 py-3 text-sm" @click="page++">Show more cards</button>
    </section>
  </main>
</template>
