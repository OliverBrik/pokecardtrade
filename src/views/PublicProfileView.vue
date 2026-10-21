<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { auth } from '@/firebase'
import { getPublicProfile, listPublicCards, listSellerListings } from '@/services/profiles'
import { calculateBundle } from '@/services/bundle'
import { contactSellerBundle } from '@/services/inquiries'
import { formatMoney } from '@/services/marketplace'
import { tradeQuantity } from '@/services/collection'
import ListingCard from '@/components/ListingCard.vue'

const route = useRoute(), router = useRouter()
const profile = ref(null), listings = ref([]), entries = ref([]), trades = ref([])
const tab = ref('sale'), search = ref(''), quantities = ref({})
const loading = ref(true), busy = ref(false), error = ref(''), cardsError = ref('')
const loadFailed = ref(false)
let request = 0
const own = computed(() => auth.currentUser?.uid === route.params.uid)
const displayName = computed(() => profile.value?.displayName || listings.value[0]?.sellerName || 'Collector')
const collectionVisible = computed(() => profile.value?.collectionPublic === true)
const tradesVisible = computed(() => collectionVisible.value || profile.value?.tradesPublic === true)
const matches = item => `${item.name} ${item.setName} ${item.localId}`.toLowerCase().includes(search.value.toLowerCase().trim())
const visibleListings = computed(() => listings.value.filter(matches))
const visibleEntries = computed(() => (tab.value === 'trade' ? trades.value : entries.value).filter(matches))
const selected = computed(() => listings.value.filter(item => quantities.value[item.id] !== undefined).map(listing => ({ listing, quantity: quantities.value[listing.id] })))
const bundle = computed(() => {
  if (!selected.value.length) return { total: null, error: '' }
  try { return { total: calculateBundle(selected.value), error: '' } }
  catch (cause) { return { total: null, error: cause.message } }
})

async function load() {
  const current = ++request
  const uid = route.params.uid
  profile.value = null; listings.value = []; entries.value = []; trades.value = []; quantities.value = {}
  error.value = ''; cardsError.value = ''; loading.value = true; loadFailed.value = false
  try {
    const [publicProfile, sale] = await Promise.all([getPublicProfile(uid), listSellerListings(uid)])
    if (current !== request) return
    profile.value = publicProfile; listings.value = sale
    try {
      const draft = JSON.parse(sessionStorage.getItem(`kardvia-bundle-${uid}`) || '{}')
      if (draft && typeof draft === 'object' && !Array.isArray(draft)) {
        for (const listing of sale) {
          const quantity = draft[listing.id]
          if (Object.keys(quantities.value).length < 10 && Number.isInteger(quantity) && quantity > 0 && quantity <= listing.quantity) quantities.value[listing.id] = quantity
        }
      }
    } catch { quantities.value = {} }
    try {
      if (publicProfile?.collectionPublic) {
        const cards = await listPublicCards(uid)
        if (current !== request) return
        entries.value = cards; trades.value = cards.filter(item => item.forTrade)
      } else if (publicProfile?.tradesPublic) {
        const cards = await listPublicCards(uid, true)
        if (current !== request) return
        trades.value = cards
      }
    } catch {
      if (current === request) cardsError.value = 'These cards could not be loaded. The owner may have changed their privacy settings.'
    }
  } catch (cause) {
    if (current === request) { error.value = cause.message; loadFailed.value = true }
  } finally { if (current === request) loading.value = false }
}

function toggle(listing, checked) {
  if (checked) quantities.value[listing.id] = 1
  else delete quantities.value[listing.id]
}

function storeDraft(value) {
  try {
    const key = `kardvia-bundle-${route.params.uid}`
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch { return false }
}

async function send() {
  if (!auth.currentUser) {
    storeDraft(quantities.value)
    return router.push({ name: 'login', query: { redirect: route.fullPath } })
  }
  busy.value = true; error.value = ''
  try {
    const thread = await contactSellerBundle(selected.value)
    storeDraft(null)
    await router.push({ name: 'messages', query: { thread } })
  } catch (cause) { error.value = cause.message }
  finally { busy.value = false }
}

watch(() => route.params.uid, () => { tab.value = 'sale'; search.value = ''; load() }, { immediate: true })
</script>

<template>
  <main class="collection-page mx-auto max-w-[1440px] space-y-6 px-6 py-10 sm:px-8 lg:px-16">
    <RouterLink to="/marketplace" class="text-sm text-apricot">← Marketplace</RouterLink>
    <p v-if="loading" role="status">Loading collector…</p>
    <p v-if="error" role="alert" class="text-red-200">{{ error }} <button :disabled="busy" class="underline" @click="load">Refresh profile</button></p>
    <template v-if="!loading && !loadFailed">
      <header class="market-panel">
        <p class="text-xs uppercase tracking-widest text-mint">Collector profile</p>
        <h1 class="display-font mt-2 text-4xl font-bold">{{ displayName }}</h1>
        <p v-if="profile?.location" class="mt-3 text-linen/60">{{ profile.location }}</p>
        <p v-if="profile?.bio" class="mt-3 max-w-3xl whitespace-pre-wrap break-words text-linen/80">{{ profile.bio }}</p>
        <p v-if="!profile" class="mt-3 text-sm text-linen/60">This collector has not published a profile. Active listings are still available below.</p>
        <RouterLink v-if="own" to="/profile" class="mt-4 inline-block text-apricot underline">Edit profile and visibility</RouterLink>
      </header>
      <div class="flex flex-wrap gap-3" aria-label="Profile sections">
        <button v-for="section in [{id:'sale',label:`For sale (${listings.length})`},{id:'collection',label:'Collection'},{id:'trade',label:'For trade'}]" :key="section.id" :aria-pressed="tab === section.id" class="rounded-xl px-5 py-3 text-sm font-bold" :class="tab === section.id ? 'bg-apricot text-ink' : 'bg-panel'" @click="tab = section.id">{{ section.label }}</button>
      </div>
      <input v-model="search" type="search" aria-label="Search this collector's cards" placeholder="Search this collector’s cards…" class="market-field" />

      <template v-if="tab === 'sale'">
        <p class="text-sm text-linen/60">Select up to 10 listings from this seller to request a combined purchase and one shipment.</p>
        <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div v-if="visibleListings.length" class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <div v-for="listing in visibleListings" :key="listing.id" class="min-w-0">
                <ListingCard :listing="listing" />
                <div v-if="!own" class="mt-2 rounded-xl bg-panel p-3">
                  <label class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="quantities[listing.id] !== undefined" :disabled="busy || (selected.length >= 10 && quantities[listing.id] === undefined)" @change="toggle(listing, $event.target.checked)" /> Add to bundle</label>
                  <label v-if="quantities[listing.id] !== undefined" class="mt-3 block text-sm">Quantity ({{ listing.quantity }} available)<input v-model.number="quantities[listing.id]" type="number" min="1" :max="listing.quantity" step="1" :disabled="busy" class="market-field mt-1" /></label>
                </div>
              </div>
            </div>
            <p v-else class="market-panel">No matching active listings.</p>
          </div>
          <aside v-if="!own" class="market-panel lg:sticky lg:top-6">
            <h2 class="display-font text-xl font-bold">Buy from this seller</h2>
            <p v-if="!selected.length" class="mt-4 text-sm text-linen/60">Choose cards to see your combined estimate.</p>
            <ul v-else class="my-4 space-y-3 text-sm"><li v-for="line in selected" :key="line.listing.id" class="flex justify-between gap-2"><span>{{ line.quantity }} × {{ line.listing.name }}</span><button :disabled="busy" :aria-label="`Remove ${line.listing.name} from bundle`" class="text-apricot" @click="delete quantities[line.listing.id]">Remove</button></li></ul>
            <p v-if="bundle.error" role="alert" class="mt-4 text-apricot">{{ bundle.error }}</p>
            <dl v-if="bundle.total" class="space-y-3 text-sm">
              <div class="flex justify-between"><dt>Cards</dt><dd>{{ formatMoney(bundle.total.subtotalCents) }}</dd></div>
              <div class="flex justify-between"><dt>{{ bundle.total.delivery === 'pickup' ? 'Pickup' : 'Estimated shipping' }}</dt><dd>{{ formatMoney(bundle.total.shippingCents) }}</dd></div>
              <div class="flex justify-between text-lg font-bold"><dt>Estimated total</dt><dd>{{ formatMoney(bundle.total.totalCents) }}</dd></div>
              <div v-if="bundle.total.savingCents" class="text-mint">Potential shipping saving: {{ formatMoney(bundle.total.savingCents) }}</div>
            </dl>
            <p class="mt-4 text-xs leading-5 text-linen/60">Shipping uses the highest individual shipping charge as an estimate. The seller confirms the final cost and availability. Cards are not reserved and no payment is taken.</p>
            <button :disabled="!bundle.total || busy" class="market-button mt-5 w-full" @click="send">{{ busy ? 'Sending…' : auth.currentUser ? 'Request combined purchase' : 'Sign in to request purchase' }}</button>
          </aside>
        </div>
      </template>
      <template v-else>
        <p v-if="tab === 'collection' ? !collectionVisible : !tradesVisible" class="market-panel">{{ tab === 'collection' ? 'This collection is private.' : 'This collector has not shared their trade cards.' }}</p>
        <p v-else-if="cardsError" role="alert" class="market-panel">{{ cardsError }} <button class="text-apricot underline" @click="load">Refresh</button></p>
        <div v-else-if="visibleEntries.length" class="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <article v-for="entry in visibleEntries" :key="entry.id" class="market-panel min-w-0">
            <img v-if="entry.image" :src="entry.image" :alt="entry.name" loading="lazy" class="h-48 w-full object-contain" />
            <h2 class="display-font mt-4 text-lg font-bold">{{ entry.name }}</h2>
            <p class="mt-2 text-xs text-linen/60">{{ entry.setName }} · {{ entry.localId }}</p>
            <p class="mt-2 text-sm">{{ entry.variant }} · {{ entry.language }} · {{ entry.condition }}</p>
            <p class="mt-2 text-sm">Quantity: {{ tab === 'trade' ? tradeQuantity(entry) : entry.quantity }}</p>
            <span v-if="entry.forTrade" class="mt-3 inline-block text-sm text-mint">{{ tradeQuantity(entry) }} marked for trade</span>
          </article>
        </div>
        <p v-else class="market-panel">No matching cards.</p>
      </template>
    </template>
  </main>
</template>
