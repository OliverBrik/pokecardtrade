<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { auth } from '@/firebase'
import { conditions, languages } from '@/services/collection'
import { listListings, toCents } from '@/services/marketplace'
import ListingCard from '@/components/ListingCard.vue'
const route = useRoute(), router = useRouter()
const listings = ref([]), loading = ref(false), error = ref(''), mine = ref(route.query.tab === 'mine')
const name = ref(''), condition = ref(''), language = ref(''), minimum = ref(''), maximum = ref(''), sort = ref('recent'), page = ref(1)
const applied = ref({name:'',condition:'',language:'',minimum:0,maximum:Infinity})
let request = 0
const filtered = computed(() => {
  const f = applied.value
  return listings.value.filter(item => (!f.name || `${item.name} ${item.localId}`.toLowerCase().includes(f.name)) && (!f.condition || item.condition === f.condition) && (!f.language || item.language === f.language) && item.priceCents >= f.minimum && item.priceCents <= f.maximum).sort((a,b) => sort.value === 'price' ? a.priceCents - b.priceCents : (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
})
const visible = computed(() => filtered.value.slice((page.value-1)*15,page.value*15))
watch(sort, () => {page.value=1})
watch(() => route.query.tab, value => {
  const desired = value === 'mine'
  if (desired !== mine.value) { mine.value = desired; page.value = 1; load() }
})
async function load() {
  const current = ++request
  loading.value=true; error.value=''
  try { const data = await listListings(mine.value); if(current === request) listings.value=data }
  catch { if(current === request) error.value='Could not load listings. Please try again.' }
  finally { if(current === request) loading.value=false }
}
async function changeTab(value) {
  if(value && !auth.currentUser) return router.push({name:'login',query:{redirect:'/marketplace?tab=mine'}})
  mine.value=value; page.value=1; await router.replace({query:value?{tab:'mine'}:{}}); load()
}
function search() {
  try {
    const min = minimum.value ? toCents(minimum.value) : 0, max = maximum.value ? toCents(maximum.value) : Infinity
    if(min > max) throw new Error('Minimum price must not exceed maximum price.')
    applied.value={name:name.value.trim().toLowerCase(),condition:condition.value,language:language.value,minimum:min,maximum:max}; page.value=1; error.value=''
  } catch(cause) {error.value=cause.message}
}
onMounted(() => {if(mine.value && !auth.currentUser) changeTab(true); else load()})
</script>
<template>
  <main class="collection-page mx-auto flex min-h-screen max-w-[1440px] flex-col gap-6 px-6 py-10 sm:px-8 lg:px-16">
    <header><p class="text-xs font-bold text-[#b4becc]">BUY AND SELL</p><h1 class="display-font mt-1 text-[40px] font-bold">Marketplace</h1><p class="mt-1">Find cards for your collection, or list your own cards for sale.</p><RouterLink to="/marketplace/create" class="mt-3 inline-block rounded-[10px] bg-apricot px-5 py-3 text-sm font-bold text-ink">+ Create listing</RouterLink></header>
    <section class="rounded-2xl border border-[#3b4a5d] bg-panel p-6" aria-label="Listing filters">
      <form class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" @submit.prevent="search"><input v-model="name" aria-label="Search listings" placeholder="Search for a card…" type="search" class="market-field" /><select v-model="condition" aria-label="Condition" class="market-field"><option value="">All conditions</option><option v-for="value in conditions" :key="value">{{ value }}</option></select><select v-model="language" aria-label="Language" class="market-field"><option value="">All languages</option><option v-for="value in languages" :key="value">{{ value }}</option></select><input v-model="minimum" aria-label="Minimum price in EUR" placeholder="Min €" inputmode="decimal" class="market-field" /><input v-model="maximum" aria-label="Maximum price in EUR" placeholder="Max €" inputmode="decimal" class="market-field" /><button class="rounded-[10px] bg-apricot px-5 py-3 text-sm font-bold text-ink">Search</button></form>
      <div class="mt-4 flex flex-wrap items-center gap-3"><button :aria-pressed="!mine" class="rounded-[10px] px-5 py-3 text-sm font-bold" :class="!mine?'bg-apricot text-ink':'bg-[#222e3d]'" @click="changeTab(false)">All listings</button><button :aria-pressed="mine" class="rounded-[10px] px-5 py-3 text-sm font-bold" :class="mine?'bg-apricot text-ink':'bg-[#222e3d]'" @click="changeTab(true)">My listings</button><label class="text-sm text-[#b4becc]">Sort <select v-model="sort" class="bg-panel p-2"><option value="recent">Recently listed</option><option value="price">Price: low to high</option></select></label></div>
    </section>
    <p v-if="error" role="alert" class="text-apricot">{{ error }} <button class="underline" @click="load">Retry</button></p><p v-if="loading" role="status" class="py-12 text-center">Loading listings…</p>
    <template v-else><h2 class="display-font text-[22px] font-bold">{{ mine?'My listings':'Latest listings' }} <span class="text-sm font-normal text-[#b4becc]">· {{ filtered.length }}</span></h2><div v-if="visible.length" class="grid gap-[23px] sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"><ListingCard v-for="listing in visible" :key="listing.id" :listing="listing" /></div><div v-else class="rounded-2xl bg-panel p-12 text-center"><h2 class="display-font text-xl font-bold">No listings found</h2><p class="mt-3 text-[#b4becc]">Try other filters or create the first listing.</p></div><nav v-if="filtered.length>15" aria-label="Listing pages" class="flex justify-center gap-5"><button :disabled="page===1" class="disabled:opacity-40" @click="page--">Previous</button><span>Page {{ page }}</span><button :disabled="page*15>=filtered.length" class="disabled:opacity-40" @click="page++">Next</button></nav></template>
  </main>
</template>
