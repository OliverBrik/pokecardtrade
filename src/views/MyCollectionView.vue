<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import CollectionCard from '@/components/CollectionCard.vue'
import SaveCardActions from '@/components/SaveCardActions.vue'
import { getCard } from '@/services/cards'
import { conditions, entryPrice, languages, listEntries, removeEntry, updateEntry, variantsFor } from '@/services/collection'

const entries = ref([])
const route = useRoute()
const router = useRouter()
const pendingCard = ref(null)
const addDialog = ref(null)
const pendingError = ref('')
const wishes = ref([])
const details = ref({})
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const warning = ref('')
const message = ref('')
const tab = ref('all')
const search = ref('')
const set = ref('')
const sort = ref('recent')
const selected = ref(null)
const dialog = ref(null)
const dialogError = ref('')
const confirmingRemoval = ref(false)
const form = reactive({ quantity: 1, variant: 'normal', language: 'English', condition: 'Near Mint', forTrade: false })
let controller
let disposed = false
const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
const price = (entry) => entryPrice(details.value[entry.cardId], entry.variant)
const priceLabel = (entry) => price(entry) == null ? 'Price unavailable' : `Est. ${money.format(price(entry))} each`
const quantity = computed(() => entries.value.reduce((total, entry) => total + entry.quantity, 0))
const trades = computed(() => entries.value.filter((entry) => entry.forTrade).reduce((total, entry) => total + entry.quantity, 0))
const priced = computed(() => entries.value.filter((entry) => price(entry) != null))
const totalValue = computed(() => priced.value.reduce((total, entry) => total + price(entry) * entry.quantity, 0))
const source = computed(() => tab.value === 'wishlist' ? wishes.value : tab.value === 'sale' ? [] : tab.value === 'trade' ? entries.value.filter((entry) => entry.forTrade) : entries.value)
const sets = computed(() => [...new Map(source.value.filter((entry) => entry.setId).map((entry) => [entry.setId, entry.setName])).entries()])
const visible = computed(() => {
  const query = search.value.trim().toLowerCase()
  return source.value.filter((entry) => (!set.value || entry.setId === set.value) && (!query || `${entry.name} ${entry.localId} ${entry.cardId}`.toLowerCase().includes(query))).sort((a, b) => {
    if (sort.value === 'name') return a.name.localeCompare(b.name)
    if (sort.value === 'value') return (price(b) ?? -1) - (price(a) ?? -1)
    return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  })
})
const variantOptions = computed(() => [...new Set([form.variant, ...variantsFor(details.value[selected.value?.cardId] ?? {})])])

function changeTab(value) { tab.value = value; set.value = ''; search.value = '' }

async function loadCardDetails(id, signal) {
  const request = new AbortController()
  const cancel = () => request.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) request.abort()
  const timeout = setTimeout(cancel, 15000)
  try { return await getCard(id, { signal: request.signal }) }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel) }
}

async function load() {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = warning.value = ''
  try {
    const [owned, wishlist] = await Promise.all([listEntries(), listEntries('wishlist')])
    if (disposed || current.signal.aborted) return
    entries.value = owned
    wishes.value = wishlist
    const ids = [...new Set([...owned, ...wishlist].map((entry) => entry.cardId))]
    const results = await Promise.allSettled(ids.map((id) => loadCardDetails(id, current.signal)))
    if (disposed || current.signal.aborted) return
    details.value = Object.fromEntries(results.flatMap((result, index) => result.status === 'fulfilled' ? [[ids[index], result.value]] : []))
    if (results.some((result) => result.status === 'rejected')) warning.value = 'Some market prices could not be loaded. Your saved cards are still available.'
  } catch {
    if (!disposed && !current.signal.aborted) error.value = 'Could not load your collection. Please try again.'
  } finally { if (!disposed && !current.signal.aborted) loading.value = false }
}

async function manage(entry) {
  selected.value = entry
  dialogError.value = ''
  confirmingRemoval.value = false
  Object.assign(form, { quantity: entry.quantity ?? 1, variant: entry.variant ?? 'normal', language: entry.language ?? 'English', condition: entry.condition ?? 'Near Mint', forTrade: entry.forTrade ?? false })
  await nextTick()
  dialog.value.showModal()
}

async function save() {
  saving.value = true
  dialogError.value = ''
  try {
    const values = { ...form }
    await updateEntry(selected.value.id, values)
    Object.assign(selected.value, values)
    dialog.value.close()
    message.value = 'Card updated.'
  } catch (cause) { dialogError.value = cause.message || 'Could not save your changes.' }
  finally { saving.value = false }
}

async function remove() {
  saving.value = true
  dialogError.value = ''
  try {
    const wishlist = tab.value === 'wishlist'
    await removeEntry(selected.value.id, wishlist ? 'wishlist' : 'collection')
    const target = wishlist ? wishes : entries
    target.value = target.value.filter((entry) => entry.id !== selected.value.id)
    dialog.value.close()
    message.value = wishlist ? 'Card removed from wishlist.' : 'Card removed from collection.'
  } catch (cause) { dialogError.value = cause.message || 'Could not remove this card.' }
  finally { saving.value = false }
}

onMounted(async () => {
  load()
  const cardId = route.query.add
  if (typeof cardId !== 'string' || !cardId) return
  try {
    pendingCard.value = await loadCardDetails(cardId)
    if (disposed) return
    await nextTick()
    addDialog.value.showModal()
  } catch { if (!disposed) pendingError.value = 'Could not load the card you selected. Find it again in Explore.' }
})
onBeforeUnmount(() => { disposed = true; controller?.abort() })
</script>

<template>
  <main class="collection-page mx-auto flex min-h-[calc(100vh-86px)] max-w-[1440px] flex-col gap-6 px-6 pt-10 pb-12 text-linen sm:px-8 lg:px-16">
    <header class="flex flex-col items-start gap-1">
      <p class="text-xs font-bold text-[#b4becc]">YOUR CARD COLLECTION</p>
      <h1 class="display-font text-[32px] leading-[1.45] font-bold tracking-[-0.8px] sm:text-[40px]">My Collection</h1>
      <p class="text-base leading-relaxed">Keep track of your cards, their value and what you want to trade.</p>
      <RouterLink to="/" class="mt-1 rounded-[10px] bg-apricot px-5 py-3 text-sm font-bold text-ink hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot">+ Find and add cards</RouterLink>
    </header>
    <p v-if="pendingError" role="alert" class="text-sm text-red-200">{{ pendingError }}</p>

    <div v-if="error" role="alert" class="rounded-2xl border border-apricot/40 bg-panel p-6"><p>{{ error }}</p><button class="mt-3 text-apricot underline" @click="load">Try again</button></div>
    <template v-else>
      <section aria-label="Collection overview" class="grid gap-6 sm:grid-cols-3">
        <div class="rounded-2xl bg-panel p-6"><p class="text-xs font-bold text-[#b4becc]">CARDS IN COLLECTION</p><p class="display-font my-1.5 text-[32px] font-bold text-apricot">{{ loading ? '—' : quantity }}</p><p class="text-[13px] text-[#b4becc]">Your own cards</p></div>
        <div class="rounded-2xl bg-panel p-6"><p class="text-xs font-bold text-[#b4becc]">ESTIMATED VALUE</p><p class="display-font my-1.5 break-words text-[32px] font-bold text-lilac">{{ loading ? '—' : !entries.length ? money.format(0) : priced.length ? money.format(totalValue) : 'Unavailable' }}</p><p class="text-[13px] text-[#b4becc]">{{ !loading && priced.length < entries.length ? 'Partial estimate · some prices unavailable' : 'Indicative market value' }}</p></div>
        <div class="rounded-2xl bg-panel p-6"><p class="text-xs font-bold text-[#b4becc]">READY TO TRADE</p><p class="display-font my-1.5 text-[32px] font-bold text-mint">{{ loading ? '—' : `${trades} cards` }}</p><p class="text-[13px] text-[#b4becc]">Find your next trade</p></div>
      </section>
      <p v-if="warning" role="status" class="text-sm text-apricot">{{ warning }} <button class="underline" @click="load">Retry</button></p>
      <p v-if="message" role="status" class="text-sm text-mint">{{ message }}</p>
      <section aria-label="Your cards" class="flex flex-col gap-5">
        <div class="flex flex-wrap gap-3" aria-label="Filter collection">
          <button v-for="item in [{ id: 'all', label: 'All cards', count: quantity }, { id: 'trade', label: 'For trade', count: trades }, { id: 'sale', label: 'For sale', count: 0 }, { id: 'wishlist', label: 'Wishlist', count: wishes.length }]" :key="item.id" type="button" :aria-pressed="tab === item.id" class="rounded-[10px] border px-5 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot" :class="tab === item.id ? 'border-apricot bg-apricot text-ink' : 'border-[#3b4a5d] bg-[#222e3d] text-linen hover:border-apricot'" @click="changeTab(item.id)">{{ item.label }} · {{ loading ? '—' : item.count }}</button>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,680fr)_252fr_348fr]">
          <input v-model="search" aria-label="Search your collection" placeholder="Search your collection…" type="search" class="min-h-12 min-w-0 rounded-[10px] border border-[#3b4a5d] bg-[#222e3d] px-4 text-sm focus-visible:outline-2 focus-visible:outline-apricot" />
          <select v-model="set" aria-label="Filter by set" class="min-h-12 min-w-0 rounded-[10px] border border-[#3b4a5d] bg-[#222e3d] px-4 text-sm focus-visible:outline-2 focus-visible:outline-apricot"><option value="">All sets</option><option v-for="[id, name] in sets" :key="id" :value="id">{{ name }}</option></select>
          <select v-model="sort" aria-label="Sort collection" class="min-h-12 min-w-0 rounded-[10px] border border-[#3b4a5d] bg-[#222e3d] px-4 text-sm focus-visible:outline-2 focus-visible:outline-apricot"><option value="recent">Recently added</option><option value="name">Name A–Z</option><option v-if="tab !== 'wishlist'" value="value">Price: high to low</option></select>
        </div>
        <p v-if="loading" role="status" class="py-12 text-center text-[#b4becc]">Loading your collection…</p>
        <div v-else-if="visible.length" class="grid grid-cols-1 gap-x-[23px] gap-y-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"><CollectionCard v-for="entry in visible" :key="entry.id" :entry="entry" :price="priceLabel(entry)" :wishlist="tab === 'wishlist'" @manage="manage" /></div>
        <div v-else class="rounded-2xl border border-[#3b4a5d] bg-panel px-6 py-14 text-center">
          <h2 class="display-font text-xl font-bold">{{ tab === 'sale' ? 'No listings yet' : search || set ? 'No matching cards' : tab === 'wishlist' ? 'Your wishlist is empty' : tab === 'trade' ? 'No cards marked for trade' : 'Your collection starts here' }}</h2>
          <p class="mx-auto mt-3 max-w-md text-sm leading-6 text-[#b4becc]">{{ tab === 'sale' ? 'Your sale listings will appear here when the marketplace is available.' : search || set ? 'Try another search or choose a different set.' : tab === 'trade' ? 'Manage a card in your collection to mark it for trade.' : 'Explore the catalogue and save the cards you own or want to collect.' }}</p>
          <RouterLink v-if="tab === 'all' || tab === 'wishlist'" to="/" class="mt-5 inline-block rounded-[10px] bg-apricot px-5 py-3 text-sm font-bold text-ink">Find cards →</RouterLink>
        </div>
        <p class="text-sm text-[#b4becc]">Manage each card’s quantity, variant and condition, or mark it for trade.</p>
        <p class="text-xs leading-5 text-[#8997aa]">Cardmarket estimates in EUR via TCGdex. Holo and reverse prices are grouped. Estimates do not account for condition or language; cards without comparable prices are excluded from the total.</p>
      </section>
    </template>

    <dialog ref="dialog" aria-labelledby="manage-title" class="m-auto max-h-[90vh] w-[min(560px,calc(100%-32px))] overflow-y-auto rounded-2xl border border-[#3b4a5d] bg-panel p-6 text-linen backdrop:bg-black/70" @cancel="(event) => { if (saving) event.preventDefault() }">
      <template v-if="selected">
        <div class="flex items-start justify-between gap-4"><div><h2 id="manage-title" class="display-font text-2xl font-bold">{{ selected.name }}</h2><p class="mt-1 text-sm text-[#b4becc]">{{ selected.setName }} · {{ selected.localId }}</p></div><button autofocus :disabled="saving" aria-label="Close card management" class="rounded px-2 py-1 text-apricot focus-visible:outline-2 focus-visible:outline-apricot" @click="dialog.close()">Close ×</button></div>
        <form v-if="tab !== 'wishlist'" class="mt-6 grid gap-4 sm:grid-cols-2" @submit.prevent="save">
          <label class="text-sm">Quantity<input v-model.number="form.quantity" required type="number" min="1" max="9999" class="mt-2 min-h-12 w-full rounded-lg border border-[#3b4a5d] bg-ink px-3" /></label>
          <label class="text-sm">Variant<select v-model="form.variant" class="mt-2 min-h-12 w-full rounded-lg border border-[#3b4a5d] bg-ink px-3"><option v-for="variant in variantOptions" :key="variant">{{ variant }}</option></select></label>
          <label class="text-sm">Language<select v-model="form.language" class="mt-2 min-h-12 w-full rounded-lg border border-[#3b4a5d] bg-ink px-3"><option v-for="language in languages" :key="language">{{ language }}</option></select></label>
          <label class="text-sm">Condition<select v-model="form.condition" class="mt-2 min-h-12 w-full rounded-lg border border-[#3b4a5d] bg-ink px-3"><option v-for="condition in conditions" :key="condition">{{ condition }}</option></select></label>
          <label class="flex items-center gap-3 py-2 sm:col-span-2"><input v-model="form.forTrade" type="checkbox" class="h-5 w-5 accent-apricot" /> Available for trade</label>
          <button :disabled="saving" class="rounded-lg bg-apricot px-5 py-3 font-bold text-ink disabled:opacity-50 sm:col-span-2" type="submit">{{ saving ? 'Saving…' : 'Save changes' }}</button>
        </form>
        <p v-if="dialogError" role="alert" class="mt-4 text-sm text-red-200">{{ dialogError }}</p>
        <div class="mt-6 border-t border-white/10 pt-4">
          <button v-if="!confirmingRemoval" :disabled="saving" class="text-sm text-red-200 underline" @click="confirmingRemoval = true">{{ tab === 'wishlist' ? 'Remove from wishlist' : 'Remove from collection' }}</button>
          <div v-else><p class="text-sm">Remove this saved entry?</p><div class="mt-3 flex gap-4"><button :disabled="saving" class="rounded-lg bg-red-300 px-4 py-2 text-ink disabled:opacity-50" @click="remove">{{ saving ? 'Removing…' : 'Remove card' }}</button><button :disabled="saving" class="text-sm text-[#b4becc]" @click="confirmingRemoval = false">Keep card</button></div></div>
        </div>
      </template>
    </dialog>
    <dialog ref="addDialog" aria-labelledby="add-title" class="m-auto max-h-[90vh] w-[min(560px,calc(100%-32px))] overflow-y-auto rounded-2xl border border-[#3b4a5d] bg-panel p-6 text-linen backdrop:bg-black/70" @close="router.replace({ name: 'my-collection' }); load()">
      <template v-if="pendingCard"><div class="flex items-start justify-between gap-4"><h2 id="add-title" class="display-font text-2xl font-bold">{{ pendingCard.name }}</h2><button autofocus class="px-2 py-1 text-apricot" @click="addDialog.close()">Close ×</button></div><SaveCardActions :card="pendingCard" @saved="load" /></template>
    </dialog>
  </main>
</template>
