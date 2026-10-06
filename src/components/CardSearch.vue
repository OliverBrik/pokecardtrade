<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { browseCards, getCard, getRarities, getSets } from '@/services/cards'
import collectorOrbits from '@/assets/figma/collector-orbits.svg'

const featuredIds = ['sv03-223', 'sv03.5-025', 'swsh11-066', 'swsh7-94', 'sv03.5-009', 'sv03.5-151', 'sv03.5-133', 'swsh7-110', 'sv03.5-143', 'sv03.5-003']
const name = ref('')
const set = ref('')
const rarity = ref('')
const number = ref('')
const moreFilters = ref(false)
const sets = ref([])
const rarities = ref([])
const filterError = ref('')
const cards = ref([])
const loading = ref(false)
const error = ref('')
const warning = ref('')
const featured = ref(true)
const page = ref(1)
const hasNext = ref(false)
const sort = ref('default')
const selected = ref(null)
const detailError = ref('')
const detailLoading = ref(false)
const priceGroup = ref('trend')
const dialog = ref(null)
const failedImages = ref(new Set())
let controller
let detailController
let applied = {}
const filtersController = new AbortController()
const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
const visibleCards = computed(() => {
  const result = [...cards.value]
  if (sort.value === 'name') result.sort((a, b) => a.name.localeCompare(b.name))
  if (sort.value === 'price') result.sort((a, b) => (a.prices?.trend ?? Infinity) - (b.prices?.trend ?? Infinity))
  return result
})
const selectedPrice = computed(() => selected.value?.prices?.[priceGroup.value] ?? null)
const fieldClass = 'min-h-[46px] min-w-0 rounded-xl border border-[#3b4a5d] bg-panel px-3 text-sm text-[#b4becc] focus-visible:outline-2 focus-visible:outline-apricot'

function formatPrice(price) {
  return price == null ? 'Price unavailable' : money.format(price)
}

function imageFailed(id) {
  failedImages.value = new Set([...failedImages.value, id])
}

async function loadCards(targetPage = 1, showFeatured = false) {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  warning.value = ''
  cards.value = []
  page.value = targetPage
  featured.value = showFeatured
  hasNext.value = false
  try {
    const summaries = showFeatured
      ? featuredIds.map((id) => ({ id }))
      : await browseCards({ ...applied, page: targetPage, signal: current.signal })
    const results = await Promise.allSettled(summaries.map((card) => getCard(card.id, { signal: current.signal })))
    if (current.signal.aborted) return
    cards.value = results.flatMap((result, index) => result.status === 'fulfilled'
      ? [result.value]
      : summaries[index].name ? [{ ...summaries[index], prices: null, detailsFailed: true }] : [])
    const failures = results.filter((result) => result.status === 'rejected').length
    if (failures) warning.value = 'Some card details could not be loaded. Please retry.'
    if (summaries.length && !cards.value.length) throw new Error('Could not load cards. Please try again.')
    hasNext.value = !showFeatured && summaries.length === 10
  } catch (cause) {
    if (!current.signal.aborted) error.value = cause.message || 'Could not load cards. Please try again.'
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

function search() {
  applied = { name: name.value, set: set.value, rarity: rarity.value, number: number.value }
  sort.value = 'default'
  loadCards(1)
}

function reset() {
  name.value = set.value = rarity.value = number.value = ''
  applied = {}
  sort.value = 'default'
  loadCards(1, true)
}

async function openCard(card) {
  detailController?.abort()
  selected.value = card
  priceGroup.value = 'trend'
  detailError.value = ''
  detailLoading.value = false
  await nextTick()
  if (!dialog.value.open) dialog.value.showModal()
  if (!card.detailsFailed) return
  const current = new AbortController()
  detailController = current
  detailLoading.value = true
  try {
    const fullCard = await getCard(card.id, { signal: current.signal })
    if (!current.signal.aborted) {
      selected.value = fullCard
      cards.value = cards.value.map((item) => item.id === fullCard.id ? fullCard : item)
    }
  } catch (cause) {
    if (!current.signal.aborted) detailError.value = cause.message
  } finally {
    if (!current.signal.aborted) detailLoading.value = false
  }
}

function closeCard() {
  detailController?.abort()
  dialog.value?.close()
}

function updatedLabel(value) {
  const date = new Date(value)
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB') : 'Unknown'
}

onMounted(async () => {
  loadCards(1, true)
  const results = await Promise.allSettled([
    getSets({ signal: filtersController.signal }),
    getRarities({ signal: filtersController.signal }),
  ])
  if (filtersController.signal.aborted) return
  if (results[0].status === 'fulfilled') sets.value = results[0].value
  if (results[1].status === 'fulfilled') rarities.value = results[1].value
  if (results.some((result) => result.status === 'rejected')) filterError.value = 'Some filters are unavailable. You can still search by name.'
})

onBeforeUnmount(() => {
  controller?.abort()
  detailController?.abort()
  filtersController.abort()
})
</script>

<template>
  <section class="card-search mx-auto flex max-w-[1440px] flex-col gap-6 px-6 pt-10 pb-12 text-linen sm:px-8 lg:px-16" aria-labelledby="catalogue-title">
    <div class="relative overflow-hidden rounded-[20px] bg-panel px-6 py-7 sm:px-8">
      <div class="relative z-10 flex flex-col gap-1.5 lg:pr-[350px]">
        <p class="text-xs font-bold tracking-[1.44px] text-apricot">KARDVIA / FOR COLLECTORS</p>
        <h1 id="catalogue-title" class="display-font text-[32px] leading-[1.4] font-bold tracking-[-0.88px] sm:text-[44px]">Next card. New story.</h1>
        <p class="text-[15px] leading-[1.4] text-[#b4becc]">Discover Pokémon cards, follow the market and find what your collection is missing.</p>
      </div>
      <img :src="collectorOrbits" alt="" width="340" height="144" class="absolute top-3 right-[52px] hidden lg:block" />
    </div>

    <form class="flex flex-col gap-3" role="search" @submit.prevent="search">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,480fr)_220fr_200fr_180fr_184fr]">
        <input v-model="name" aria-label="Search by card name" placeholder="Search by card name…" type="search" :class="fieldClass" />
        <select v-model="set" aria-label="Card set" :class="fieldClass" :disabled="!sets.length">
          <option value="">All sets</option>
          <option v-for="item in sets" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
        <select v-model="rarity" aria-label="Rarity" :class="fieldClass" :disabled="!rarities.length">
          <option value="">All rarities</option>
          <option v-for="item in rarities" :key="item" :value="item">{{ item }}</option>
        </select>
        <button type="button" :class="fieldClass" :aria-expanded="moreFilters" aria-controls="additional-card-filters" @click="moreFilters = !moreFilters">More filters {{ moreFilters ? '−' : '+' }}</button>
        <button type="submit" class="min-h-[46px] rounded-xl bg-apricot px-5 text-sm font-bold text-ink hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot">Search</button>
      </div>
      <div v-if="moreFilters" id="additional-card-filters" class="flex flex-wrap items-end gap-4 rounded-xl bg-panel p-4">
        <label class="flex flex-col gap-2 text-sm text-[#b4becc]">Card number in set
          <input v-model="number" placeholder="e.g. 025" :class="fieldClass" />
        </label>
        <p class="pb-3 text-xs text-[#b4becc]">Use the exact printed number. Select a set to narrow your search.</p>
      </div>
      <p v-if="filterError" role="status" class="text-sm text-apricot">{{ filterError }}</p>
    </form>

    <div class="flex flex-wrap items-center gap-x-10 gap-y-3">
      <h2 class="display-font text-[22px] font-bold">{{ featured ? 'Featured cards' : 'Search results' }}</h2>
      <p role="status" aria-live="polite" class="text-sm text-[#b4becc]">{{ loading ? 'Loading cards…' : `Showing ${cards.length} cards${featured ? '' : ` · Page ${page}`}` }}</p>
      <label class="flex items-center gap-2 text-sm text-[#b4becc]">Sort this page:
        <select v-model="sort" class="max-w-[180px] rounded bg-ink p-1 focus-visible:outline-2 focus-visible:outline-apricot">
          <option value="default">Default</option>
          <option value="name">Name A–Z</option>
          <option value="price">Price: low to high</option>
        </select>
      </label>
      <button v-if="!featured" type="button" class="text-sm text-apricot hover:underline" @click="reset">Reset search</button>
    </div>

    <div v-if="error" role="alert" class="rounded-2xl border border-apricot/40 bg-panel p-6">
      <p>{{ error }}</p>
      <button class="mt-4 rounded-lg bg-apricot px-5 py-2 text-ink" @click="loadCards(page, featured)">Try again</button>
    </div>
    <p v-if="warning && !error" role="status" class="text-sm text-apricot">{{ warning }} <button class="underline" @click="loadCards(page, featured)">Retry</button></p>
    <div v-if="loading" aria-hidden="true" class="grid grid-cols-1 gap-x-[23px] gap-y-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      <div v-for="index in 10" :key="index" class="h-[369px] rounded-2xl border border-[#3b4a5d] bg-panel motion-safe:animate-pulse" />
    </div>
    <div v-else-if="cards.length" class="grid grid-cols-1 gap-x-[23px] gap-y-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      <button v-for="card in visibleCards" :key="card.id" type="button" :aria-label="`View ${card.name}, ${card.id}`" class="flex min-w-0 flex-col gap-2 rounded-2xl border border-[#3b4a5d] bg-panel p-4 text-left transition-colors hover:border-apricot focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot" @click="openCard(card)">
        <div class="flex h-[218px] w-full items-center justify-center overflow-hidden rounded-xl">
          <img v-if="card.image && !failedImages.has(card.id)" :src="card.image" :alt="card.name" class="h-full w-full object-contain" loading="lazy" @error="imageFailed(card.id)" />
          <span v-else class="text-sm text-[#b4becc]">Image unavailable</span>
        </div>
        <h3 class="display-font mt-0.5 text-lg leading-[1.4] font-bold">{{ card.name }}</h3>
        <p class="text-xs leading-[1.4] text-[#b4becc]">{{ card.set?.name ?? 'Set unavailable' }} · {{ card.localId }}<template v-if="card.set?.cardCount?.official">/{{ card.set.cardCount.official }}</template></p>
        <p class="display-font mt-auto text-lg leading-[1.4] font-bold">{{ card.prices?.trend != null ? `Est. ${formatPrice(card.prices.trend)}` : 'Price unavailable' }}</p>
        <span class="text-[13px] leading-[1.4] text-apricot">View card →</span>
      </button>
    </div>
    <div v-else-if="!error" class="rounded-2xl bg-panel px-6 py-12 text-center">
      <h3 class="display-font text-xl font-bold">No cards found</h3>
      <p class="mt-2 text-[#b4becc]">Try another name or remove a filter.</p>
      <button class="mt-4 text-apricot hover:underline" @click="reset">Show featured cards</button>
    </div>

    <nav v-if="!featured && !loading && !error" aria-label="Results pages" class="flex items-center justify-center gap-5">
      <button :disabled="page === 1" class="rounded-xl border border-[#3b4a5d] px-5 py-3 disabled:opacity-40" @click="loadCards(page - 1)">Previous</button>
      <span class="text-sm text-[#b4becc]">Page {{ page }}</span>
      <button :disabled="!hasNext" class="rounded-xl border border-[#3b4a5d] px-5 py-3 disabled:opacity-40" @click="loadCards(page + 1)">Next</button>
    </nav>
    <p class="text-xs leading-relaxed text-[#b4becc]">Cardmarket trend estimates in EUR via TCGdex. Prices depend on the card variant and may be unavailable.</p>

    <dialog ref="dialog" aria-labelledby="card-detail-title" class="m-auto max-h-[90vh] w-[min(880px,calc(100%-32px))] overflow-y-auto rounded-[20px] border border-[#3b4a5d] bg-ink p-6 text-linen backdrop:bg-black/70 sm:p-8" @close="detailController?.abort()" @click="(event) => { if (event.target === dialog) closeCard() }">
      <template v-if="selected">
        <div class="mb-6 flex items-start justify-between gap-4">
          <div>
            <p class="mb-1 text-xs tracking-wider text-apricot">EXPLORE / CARD DETAILS</p>
            <h2 id="card-detail-title" class="display-font text-3xl font-bold">{{ selected.name }}</h2>
            <p class="mt-2 text-sm text-[#b4becc]">{{ selected.set?.name }} · {{ selected.localId }} · {{ selected.rarity }}</p>
          </div>
          <button autofocus aria-label="Close card details" class="rounded-lg px-3 py-2 text-apricot focus-visible:outline-2 focus-visible:outline-apricot" @click="closeCard">Close ×</button>
        </div>
        <div class="grid gap-6 sm:grid-cols-[240px_1fr]">
          <div class="flex min-h-[280px] items-center justify-center rounded-2xl bg-panel p-5">
            <img v-if="selected.image && !failedImages.has(selected.id)" :src="selected.image" :alt="selected.name" class="max-h-[360px] w-full object-contain" @error="imageFailed(selected.id)" />
            <p v-else class="text-sm text-[#b4becc]">Image unavailable</p>
          </div>
          <div class="rounded-2xl bg-panel p-6">
            <p v-if="detailLoading" role="status">Loading card details…</p>
            <div v-else-if="detailError" role="alert"><p>{{ detailError }}</p><button class="mt-3 text-apricot" @click="openCard(selected)">Try again</button></div>
            <template v-else>
              <label class="flex flex-col gap-2 text-sm text-[#b4becc]">Price group
                <select v-model="priceGroup" :class="fieldClass">
                  <option value="trend">Standard trend</option>
                  <option value="trendHolo">Holo / reverse trend</option>
                </select>
              </label>
              <p class="mt-6 text-sm text-[#b4becc]">Estimated market price</p>
              <p class="display-font my-2 text-4xl font-bold">{{ formatPrice(selectedPrice) }}</p>
              <p class="text-sm text-mint">Cardmarket · EUR</p>
              <p class="mt-4 text-xs text-[#b4becc]">Updated: {{ updatedLabel(selected.prices?.updatedAt) }}</p>
              <p class="mt-5 text-sm leading-relaxed text-[#b4becc]">A guide price, not a sale offer. Check the printing and price group; condition and language can affect value.</p>
            </template>
          </div>
        </div>
      </template>
    </dialog>
  </section>
</template>

<style scoped>
@font-face {
  font-family: 'Kardvia Inter';
  src: url('../assets/fonts/inter-regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Kardvia Inter';
  src: url('../assets/fonts/inter-bold.ttf') format('truetype');
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: 'Kardvia Space';
  src: url('../assets/fonts/space-grotesk-bold.ttf') format('truetype');
  font-weight: 700;
  font-display: swap;
}
.card-search { font-family: 'Kardvia Inter', sans-serif; }
.display-font { font-family: 'Kardvia Space', sans-serif; }
</style>
