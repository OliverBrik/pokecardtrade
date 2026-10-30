<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { auth } from '@/firebase'
import { listEntries, tradeQuantity } from '@/services/collection'
import { getPublicProfile } from '@/services/profiles'
import { findTradeMatches, respondToTrade, sendTradeProposal, setTradingEnabled, tradingEnabled, watchTrades } from '@/services/trading'
import TradeCardList from '@/components/TradeCardList.vue'
import TradeDiscussion from '@/components/TradeDiscussion.vue'
import { loadGoalContext } from '@/services/goals'
import { goalMatches, projectedGoal } from '@/services/goal-logic'

const loading = ref(true), busy = ref(false), searching = ref(false), error = ref(''), notice = ref('')
const enabled = ref(false), profile = ref(null), entries = ref([]), wishes = ref([])
const matches = ref([]), cursor = ref(null), searched = ref(false), tab = ref('matches')
const proposals = ref([]), proposalsLoading = ref(true), proposalsError = ref(''), proposalFilter = ref('active')
const selected = ref(null), give = ref({}), receive = ref({}), message = ref(''), proposalId = ref(''), dialogError = ref('')
const dialog = ref(null), sending = ref(false), actionId = ref('')
const conversations = ref({})
const route = useRoute()
const goalContext = ref(null), goalError = ref('')
const goalId = computed(() => typeof route.query.goal === 'string' ? route.query.goal : '')
const visibleMatches = computed(() => goalId.value ? goalContext.value ? goalMatches(matches.value, goalContext.value.progress, goalContext.value.goal) : [] : matches.value)
const projection = computed(() => {
  if (!goalContext.value || !selected.value) return null
  const offered = selected.value.give.filter(card => give.value[card.entryId] > 0).map(card => ({ ...card, quantity: give.value[card.entryId] }))
  const incoming = selected.value.receive.filter(card => receive.value[card.entryId] > 0).map(card => ({ ...card, quantity: receive.value[card.entryId] }))
  return projectedGoal(goalContext.value.catalogue.cards, goalContext.value.entries, goalContext.value.goal, offered, incoming)
})
let stopTrades, disposed = false, searchVersion = 0, loadVersion = 0
const uid = auth.currentUser.uid
const shared = computed(() => profile.value?.collectionPublic || profile.value?.tradesPublic)
const ready = computed(() => enabled.value && shared.value)
const copies = computed(() => entries.value.reduce((sum, entry) => sum + tradeQuantity(entry), 0))
const active = computed(() => proposals.value.filter(item => ['pending', 'accepted'].includes(item.status)))
const visibleProposals = computed(() => proposalFilter.value === 'active' ? active.value : proposals.value)
const canSend = computed(() => Object.keys(give.value).length && Object.keys(receive.value).length)

async function load() {
  const version = ++loadVersion
  loading.value = true
  error.value = ''
  try {
    const [consent, published, cards, wishlist] = await Promise.all([tradingEnabled(), getPublicProfile(uid), listEntries(), listEntries('wishlist')])
    if (disposed || version !== loadVersion) return
    enabled.value = consent; profile.value = published; entries.value = cards; wishes.value = wishlist
    goalContext.value = null; goalError.value = ''
    if (goalId.value) {
      try {
        const context = await loadGoalContext(goalId.value)
        if (disposed || version !== loadVersion) return
        goalContext.value = context
      }
      catch (cause) { if (!disposed && version === loadVersion) goalError.value = cause.message || 'Could not load your collection goal.' }
    }
    if (disposed || version !== loadVersion) return
    if (ready.value) await search()
  } catch (cause) { if (!disposed && version === loadVersion) error.value = cause.message || 'Could not load trading. Please try again.' }
  finally { if (!disposed && version === loadVersion) loading.value = false }
}

async function search(more = false) {
  const version = ++searchVersion
  searching.value = true; error.value = ''; searched.value = false
  if (!more) { matches.value = []; cursor.value = null }
  try {
    const result = await findTradeMatches(more ? cursor.value : null)
    if (disposed || version !== searchVersion) return
    const combined = new Map([...matches.value, ...result.matches].map(item => [item.uid, item]))
    matches.value = [...combined.values()].sort((a, b) => (b.receive.length + b.give.length) - (a.receive.length + a.give.length))
    cursor.value = result.cursor; searched.value = true
  } catch (cause) { if (!disposed && version === searchVersion) error.value = cause.message || 'Could not find matches.' }
  finally { if (!disposed && version === searchVersion) searching.value = false }
}

async function changeConsent(value) {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    await setTradingEnabled(value)
    enabled.value = value
    if (value && shared.value) await search()
    else { ++searchVersion; matches.value = []; cursor.value = null; searched.value = false; searching.value = false }
    notice.value = value ? 'Matching enabled. Only relevant matches are shared with participating collectors.' : 'Matching disabled. Your existing proposals remain private to their participants.'
  } catch (cause) { error.value = cause.message || 'Could not save your matching preference.' }
  finally { busy.value = false }
}

async function propose(match) {
  selected.value = match; give.value = {}; receive.value = {}; message.value = ''; dialogError.value = ''
  proposalId.value = crypto.randomUUID()
  await nextTick()
  dialog.value.showModal()
}

function lines(selection) {
  return Object.entries(selection).map(([entryId, quantity]) => ({ entryId, quantity }))
}

async function send() {
  sending.value = true; dialogError.value = ''
  try {
    await sendTradeProposal({ proposalId: proposalId.value, recipientId: selected.value.uid, give: lines(give.value), receive: lines(receive.value), message: message.value })
    dialog.value.close(); selected.value = null; tab.value = 'proposals'; proposalFilter.value = 'active'
    notice.value = 'Proposal sent. The cards are not reserved; arrange delivery with the other collector.'
  } catch (cause) { dialogError.value = cause.message || 'Could not send your proposal.' }
  finally { sending.value = false }
}

async function respond(trade, action) {
  actionId.value = trade.id; error.value = ''; notice.value = ''
  try {
    await respondToTrade(trade.id, action)
    notice.value = action === 'complete' ? 'Your completion confirmation was saved. The trade is complete when both collectors confirm. Update your collection to reflect the exchanged cards.' : 'Proposal updated.'
  } catch (cause) { error.value = cause.message || 'Could not update the proposal.' }
  finally { actionId.value = '' }
}

onMounted(() => {
  load()
  stopTrades = watchTrades(data => { proposals.value = data; proposalsLoading.value = false; proposalsError.value = '' }, () => {
    proposalsLoading.value = false; proposalsError.value = 'Could not load proposals. Check your connection and reload.'
  })
})
watch(goalId, () => {
  ++searchVersion; matches.value = []; selected.value = null; dialog.value?.close()
  load()
})
onBeforeUnmount(() => { disposed = true; ++searchVersion; ++loadVersion; stopTrades?.() })
</script>

<template>
  <main class="mx-auto min-h-[calc(100vh-86px)] max-w-[1440px] space-y-7 px-6 py-10 text-linen sm:px-8 lg:px-16">
    <header class="flex flex-wrap items-end justify-between gap-5">
      <div><p class="text-xs font-bold tracking-widest text-mint">COLLECT TOGETHER</p><h1 class="display-font mt-2 text-4xl font-bold sm:text-5xl">Your next card.<br /><span class="text-apricot">Someone else’s next trade.</span></h1><p class="mt-4 max-w-xl text-linen/65">Find collectors who have cards you want — and want cards you can offer.</p></div>
      <RouterLink to="/my-collection?tab=trade" class="rounded-xl border border-linen/20 px-5 py-3 text-sm font-bold hover:border-apricot">Manage my trade cards →</RouterLink>
    </header>

    <p v-if="error" role="alert" class="rounded-xl border border-red-200/30 bg-panel p-4 text-sm text-red-200">{{ error }} <button :disabled="loading || searching" class="ml-2 underline disabled:opacity-50" @click="load">Try again</button></p>
    <RouterLink v-if="error" to="/demo" class="inline-block text-sm text-apricot underline">Try the isolated trading demo while matching is unavailable →</RouterLink>
    <p v-if="notice" role="status" class="rounded-xl bg-mint/10 p-4 text-sm text-mint">{{ notice }}</p>
    <section v-if="goalId" aria-label="Selected collection goal" class="rounded-2xl border border-mint/30 bg-panel p-5">
      <template v-if="goalContext"><h2 class="display-font text-xl font-bold">Complete {{ goalContext.goal.setName }}</h2><p class="mt-2 text-sm text-linen/65">{{ goalContext.progress.collected }} / {{ goalContext.progress.total }} collected · {{ goalContext.progress.missing.length }} missing. Matches below show cards that fill gaps in this goal, ranked by unique card numbers.</p><p class="mt-2 text-xs text-linen/55">Add missing cards to your wishlist first. Matching still respects your existing wishlist preferences and both collectors’ consent.</p></template>
      <p v-else-if="goalError" role="alert" class="text-sm text-red-200">{{ goalError }}</p>
      <p v-else role="status" class="text-sm text-linen/60">Loading your collection goal…</p>
      <div class="mt-4 flex flex-wrap gap-5 text-sm"><RouterLink to="/goals" class="text-mint underline">Manage collection goals →</RouterLink><RouterLink to="/trading" class="text-apricot underline">Show all wishlist matches →</RouterLink></div>
    </section>
    <p v-if="loading" role="status" class="py-10 text-center text-linen/60">Loading your trading overview…</p>

    <template v-else>
      <section aria-label="Your trading overview" class="grid gap-4 sm:grid-cols-3">
        <RouterLink to="/my-collection?tab=trade" class="rounded-2xl border border-linen/10 bg-panel p-5 hover:border-mint/50"><p class="text-xs font-bold text-linen/55">COPIES MARKED FOR TRADE</p><p class="display-font mt-2 text-3xl font-bold text-mint">{{ copies }}</p><p class="mt-2 text-xs text-linen/55">Active sale quantities are excluded from matches.</p></RouterLink>
        <RouterLink to="/my-collection?tab=wishlist" class="rounded-2xl border border-linen/10 bg-panel p-5 hover:border-lilac/50"><p class="text-xs font-bold text-linen/55">CARDS ON YOUR WISHLIST</p><p class="display-font mt-2 text-3xl font-bold text-lilac">{{ wishes.length }}</p><p class="mt-2 text-xs text-linen/55">Set your preferred variant, language and condition.</p></RouterLink>
        <button class="rounded-2xl border border-linen/10 bg-panel p-5 text-left hover:border-apricot/50" @click="tab = 'proposals'"><p class="text-xs font-bold text-linen/55">ACTIVE PROPOSALS</p><p class="display-font mt-2 text-3xl font-bold text-apricot">{{ proposalsLoading ? '—' : active.length }}</p><p class="mt-2 text-xs text-linen/55">Review incoming and outgoing trades.</p></button>
      </section>

      <section aria-labelledby="matching-settings" class="rounded-2xl border border-linen/15 bg-panel p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-5"><div class="max-w-2xl"><h2 id="matching-settings" class="display-font text-xl font-bold">Choose to be discoverable</h2><p class="mt-2 text-sm leading-6 text-linen/65">When you enable matching, participating collectors can see your public name and location, relevant trade cards and which of their trade cards match your wishes. Your full wishlist, email and private collection stay private.</p></div><button :disabled="busy || searching || (!enabled && !shared)" :aria-pressed="enabled" class="min-h-11 rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50" :class="enabled ? 'border border-mint/50 text-mint' : 'bg-apricot text-ink'" @click="changeConsent(!enabled)">{{ busy ? 'Saving…' : enabled ? 'Disable matching' : 'Enable matching' }}</button></div>
        <p v-if="!shared" class="mt-4 rounded-xl bg-ink/50 p-4 text-sm text-apricot">First publish your profile and share your trade cards. <RouterLink to="/profile" class="underline">Open profile settings →</RouterLink></p>
      </section>

      <div class="flex flex-wrap gap-3" aria-label="Trading sections"><button v-for="section in [{ id: 'matches', label: 'Find matches' }, { id: 'proposals', label: 'My proposals' }]" :key="section.id" :aria-pressed="tab === section.id" class="rounded-xl px-5 py-3 text-sm font-bold" :class="tab === section.id ? 'bg-apricot text-ink' : 'border border-linen/15 bg-panel'" @click="tab = section.id">{{ section.label }}</button></div>

      <section v-if="tab === 'matches'" aria-labelledby="matches-title" class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 id="matches-title" class="display-font text-2xl font-bold">A match in both directions</h2><p class="mt-2 text-sm text-linen/60">Matches respect wishlist variants, languages and minimum condition.</p></div><button v-if="ready" :disabled="searching || busy" class="rounded-lg border border-linen/20 px-4 py-2 text-sm disabled:opacity-50" @click="search()">{{ searching ? 'Searching…' : 'Refresh matches' }}</button></div>
        <div v-if="!ready" class="rounded-2xl border border-dashed border-linen/20 p-10 text-center"><h3 class="display-font text-xl font-bold">Make room for your next favourite</h3><p class="mx-auto mt-3 max-w-lg text-sm leading-6 text-linen/60">Add cards to your wishlist, mark copies for trade and enable matching above. You decide which copies to keep.</p><RouterLink to="/my-collection" class="mt-5 inline-block text-apricot underline">Prepare your collection →</RouterLink></div>
        <p v-else-if="!copies || !wishes.length" class="rounded-2xl bg-panel p-6 text-sm text-linen/65">You need both a wishlist and cards marked for trade to get a mutual match. <RouterLink to="/my-collection" class="text-apricot underline">Manage collection →</RouterLink></p>
        <p v-if="searching" role="status" class="py-5 text-center text-sm text-linen/60">Checking participating collectors…</p>
        <div v-if="ready" class="grid items-start gap-5 xl:grid-cols-2">
          <article v-for="match in visibleMatches" :key="match.uid" class="rounded-2xl border border-linen/15 bg-panel p-5 sm:p-6">
            <div class="flex items-start justify-between gap-4"><div><RouterLink :to="`/collectors/${match.uid}`" class="display-font text-xl font-bold hover:text-apricot">{{ match.displayName }} ↗</RouterLink><p class="mt-1 text-sm text-linen/50">{{ match.location || 'Location not shared' }}</p></div><span class="rounded-full bg-mint/10 px-3 py-1 text-xs font-bold text-mint">Mutual match</span></div>
            <p v-if="goalContext" class="mt-4 rounded-xl bg-mint/10 p-3 text-sm text-mint">This collector can fill {{ match.goalFills }} {{ match.goalFills === 1 ? 'gap' : 'gaps' }} in {{ goalContext.goal.setName }} — and wants cards you can offer.</p>
            <div class="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 class="mb-3 text-sm font-bold text-lilac">They have {{ match.receive.length }} of your wishes</h3><TradeCardList :cards="match.receive" /></div><div><h3 class="mb-3 text-sm font-bold text-mint">You have {{ match.give.length }} of their wishes</h3><TradeCardList :cards="match.give" /></div></div>
            <button class="mt-5 w-full rounded-xl bg-apricot px-5 py-3 text-sm font-bold text-ink" @click="propose(match)">Build a trade proposal →</button>
          </article>
        </div>
        <div v-if="ready && searched && !visibleMatches.length && copies && wishes.length && !goalError" class="rounded-2xl border border-linen/15 bg-panel p-10 text-center"><h3 class="display-font text-xl font-bold">No mutual matches found{{ goalContext ? ' for this goal' : '' }}{{ cursor ? ' in this group' : '' }}</h3><p class="mt-3 text-sm text-linen/60">A match needs available cards and matching wishes on both sides. More participating collectors and a broader wishlist can help.</p></div>
        <button v-if="ready && cursor" :disabled="searching" class="rounded-xl border border-apricot/50 px-5 py-3 text-sm font-bold text-apricot disabled:opacity-50" @click="search(true)">Check more collectors</button>
      </section>

      <section v-else aria-labelledby="proposals-title" class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3"><h2 id="proposals-title" class="display-font text-2xl font-bold">My proposals</h2><select v-model="proposalFilter" aria-label="Filter proposals" class="rounded-xl border border-linen/20 bg-panel px-4 py-3 text-sm"><option value="active">Active proposals</option><option value="all">All proposals</option></select></div>
        <p class="text-sm leading-6 text-linen/60">Proposals do not reserve cards or arrange delivery. Acceptance rechecks availability. Both collectors confirm completion after exchanging cards; update your collections manually afterwards.</p>
        <p v-if="proposalsError" role="alert" class="text-sm text-red-200">{{ proposalsError }}</p>
        <p v-else-if="proposalsLoading" role="status">Loading proposals…</p>
        <p v-else-if="!visibleProposals.length" class="rounded-2xl bg-panel p-8 text-center text-linen/60">No {{ proposalFilter === 'active' ? 'active ' : '' }}proposals yet.</p>
        <article v-for="trade in visibleProposals" :key="trade.id" class="rounded-2xl border border-linen/15 bg-panel p-5 sm:p-6">
          <header class="flex flex-wrap items-start justify-between gap-3"><div><h3 class="display-font text-xl font-bold">{{ trade.senderId === uid ? `Your proposal to ${trade.recipientName}` : `${trade.senderName} proposed a trade` }}</h3><p class="mt-2 text-xs text-linen/50">{{ trade.createdAt?.toDate?.().toLocaleDateString('en-GB') }}</p></div><span class="rounded-full bg-lilac/15 px-3 py-1 text-sm capitalize text-lilac">{{ trade.status }}</span></header>
          <div class="mt-5 grid gap-5 md:grid-cols-2"><div><h4 class="mb-3 text-sm font-bold text-mint">You give</h4><TradeCardList :cards="trade.senderId === uid ? trade.give : trade.receive" /></div><div><h4 class="mb-3 text-sm font-bold text-lilac">You receive</h4><TradeCardList :cards="trade.senderId === uid ? trade.receive : trade.give" /></div></div>
          <p v-if="trade.message" class="mt-5 whitespace-pre-wrap break-words rounded-xl bg-ink/50 p-4 text-sm leading-6">{{ trade.message }}</p>
          <div class="mt-5 flex flex-wrap items-center gap-3">
            <template v-if="trade.status === 'pending' && trade.recipientId === uid"><button :disabled="!!actionId" class="rounded-lg bg-mint px-4 py-3 text-sm font-bold text-ink disabled:opacity-50" @click="respond(trade, 'accept')">Accept proposal</button><button :disabled="!!actionId" class="rounded-lg border border-linen/20 px-4 py-3 text-sm disabled:opacity-50" @click="respond(trade, 'decline')">Decline</button></template>
            <template v-if="trade.status === 'accepted'"><button v-if="!trade.completedBy.includes(uid)" :disabled="!!actionId" class="rounded-lg bg-mint px-4 py-3 text-sm font-bold text-ink disabled:opacity-50" @click="respond(trade, 'complete')">I have completed the exchange</button><p v-else class="text-sm text-mint">You confirmed completion. Waiting for the other collector.</p></template>
            <button v-if="trade.status === 'accepted' || (trade.status === 'pending' && trade.senderId === uid)" :disabled="!!actionId" class="rounded-lg border border-linen/20 px-4 py-3 text-sm disabled:opacity-50" @click="respond(trade, 'cancel')">Cancel proposal</button>
            <RouterLink :to="`/collectors/${trade.senderId === uid ? trade.recipientId : trade.senderId}`" class="text-sm text-apricot underline">View collector</RouterLink>
            <p v-if="actionId === trade.id" role="status" class="text-sm text-linen/60">Updating proposal…</p>
          </div>
          <button class="mt-5 text-sm text-apricot underline" :aria-expanded="!!conversations[trade.id]" @click="conversations[trade.id] = !conversations[trade.id]">{{ conversations[trade.id] ? 'Close conversation' : 'Open private conversation' }}</button>
          <TradeDiscussion v-if="conversations[trade.id]" :trade-id="trade.id" />
        </article>
      </section>
    </template>

    <dialog ref="dialog" aria-labelledby="proposal-title" class="m-auto max-h-[90vh] w-[min(900px,calc(100%-32px))] overflow-y-auto rounded-2xl border border-linen/20 bg-panel p-5 text-linen backdrop:bg-black/70 sm:p-7" @cancel="event => { if (sending) event.preventDefault() }">
      <template v-if="selected"><div class="flex items-start justify-between gap-4"><div><h2 id="proposal-title" class="display-font text-2xl font-bold">Trade with {{ selected.displayName }}</h2><p class="mt-2 text-sm text-linen/60">Choose up to 10 entries per side and the exact number of copies.</p></div><button autofocus :disabled="sending" aria-label="Close proposal" class="px-2 py-1 text-apricot" @click="dialog.close()">Close ×</button></div>
        <p v-if="projection" role="status" class="mt-4 rounded-xl bg-mint/10 p-4 text-sm text-mint">If completed: {{ goalContext.goal.setName }} {{ goalContext.progress.percent }}% → {{ projection.percent }}% ({{ projection.collected }} / {{ projection.total }}). This includes any last copies you give away. Your collection changes only when you update it after the exchange.</p>
        <form class="mt-6 space-y-5" @submit.prevent="send"><fieldset :disabled="sending" class="space-y-5"><div class="grid gap-6 md:grid-cols-2"><div><h3 class="mb-3 font-bold text-mint">You give</h3><TradeCardList v-model="give" :cards="selected.give" selectable /></div><div><h3 class="mb-3 font-bold text-lilac">You receive</h3><TradeCardList v-model="receive" :cards="selected.receive" selectable /></div></div><label class="block text-sm">Message and delivery preferences<textarea v-model="message" required maxlength="1000" placeholder="Suggest how and where you would like to exchange the cards. You can agree on details in the proposal’s private conversation." class="market-field mt-2 min-h-28" /></label><p class="text-xs leading-5 text-linen/60">Check the actual condition and agree on delivery together. This proposal does not reserve cards, process payment or change either collection.</p><p v-if="dialogError" role="alert" class="text-sm text-red-200">{{ dialogError }}</p><button :disabled="sending || !canSend || !ready" class="w-full rounded-xl bg-apricot px-5 py-3 font-bold text-ink disabled:opacity-50">{{ sending ? 'Sending…' : 'Send trade proposal' }}</button></fieldset></form>
      </template>
    </dialog>
  </main>
</template>
