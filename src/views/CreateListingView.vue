<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { auth } from '@/firebase'
import { listEntries, entryPrice } from '@/services/collection'
import { getCard } from '@/services/cards'
import { discardPhotos, formatMoney, getListing, listListings, saveListing, toCents, uploadPhotos } from '@/services/marketplace'
const route=useRoute(), router=useRouter()
const entries=ref([]), entryId=ref(''), existing=ref(null), card=ref(null), loading=ref(true), saving=ref(false), error=ref(''), photos=ref([]), previews=ref([]), files=ref([]), imageFailed=ref(false)
const form=reactive({quantity:1,price:'',shipping:'',delivery:'tracked',description:''})
const selected=computed(() => entries.value.find(entry=>entry.id===entryId.value))
const estimate=computed(()=>entryPrice(card.value,selected.value?.variant))
const amount=computed(()=>{try{return toCents(form.price)}catch{return null}})
const shipping=computed(()=>{try{return form.delivery==='pickup'?0:toCents(form.shipping)}catch{return null}})
const total=computed(()=>amount.value===null||shipping.value===null||!Number.isInteger(form.quantity)||form.quantity<1||form.quantity>(selected.value?.quantity??0)?null:amount.value*form.quantity+shipping.value)
const ratio=computed(()=>estimate.value>0 && amount.value!==null?amount.value/estimate.value:null)
let detailController
function clearPreviews(){previews.value.forEach(url=>URL.revokeObjectURL(url)); previews.value=[]}
function choosePhotos(event){
  const chosen=[...event.target.files]
  if(chosen.length+photos.value.length>4 || chosen.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)){error.value='Choose up to four JPG, PNG or WebP photos, up to 5 MB each.'; event.target.value='';return}
  clearPreviews(); files.value=chosen; previews.value=chosen.map(file=>URL.createObjectURL(file));error.value=''
}
async function chooseCard(){
  detailController?.abort(); card.value=null;imageFailed.value=false
  if(!selected.value)return
  const current=new AbortController();detailController=current
  const timeout=setTimeout(()=>current.abort(),15000)
  try{const data=await getCard(selected.value.cardId,{signal:current.signal});if(!current.signal.aborted)card.value=data}catch{/* Price information is optional. */}finally{clearTimeout(timeout)}
}
async function submit(){
  if(!selected.value)return
  saving.value=true;error.value=''
  let uploaded=[]
  try{
    if(!Number.isInteger(form.quantity)||form.quantity<1||form.quantity>selected.value.quantity)throw new Error('Choose a quantity available in your collection.')
    if(!toCents(form.price))throw new Error('Enter a price greater than zero.')
    if(form.delivery==='tracked')toCents(form.shipping)
    uploaded=await uploadPhotos(`${auth.currentUser.uid}_${entryId.value}`,files.value)
    const id=await saveListing(entryId.value,{...form},[...photos.value,...uploaded],existing.value)
    // The saved listing now owns these uploads; navigation errors must not delete them.
    uploaded=[]
    if(existing.value) await discardPhotos(existing.value.photos.filter(photo => !photos.value.some(kept => kept.path === photo.path)))
    await router.push(`/marketplace/${id}`)
  }catch(cause){await discardPhotos(uploaded);error.value=cause.message||'Could not publish your listing. Your form has been kept.'}finally{saving.value=false}
}
onMounted(async()=>{
  try{
    entries.value=await listEntries()
    if(route.params.id){
      existing.value=await getListing(route.params.id)
      if(existing.value.sellerId!==auth.currentUser.uid||existing.value.status!=='active')throw new Error('Only your active listings can be edited.')
      entryId.value=existing.value.entryId;photos.value=existing.value.photos
      Object.assign(form,{quantity:existing.value.quantity,price:(existing.value.priceCents/100).toFixed(2),shipping:(existing.value.shippingCents/100).toFixed(2),delivery:existing.value.delivery,description:existing.value.description})
    }else{
      const listings = await listListings(true)
      entries.value = entries.value.filter(entry => !listings.some(listing => listing.status === 'active' && listing.entryId === entry.id))
      entryId.value=entries.value.some(entry=>entry.id===route.query.entry)?route.query.entry:entries.value[0]?.id??''
    }
    chooseCard()
  }catch(cause){error.value=cause.message||'Could not load your collection.'}finally{loading.value=false}
})
onBeforeUnmount(()=>{clearPreviews();detailController?.abort()})
</script>
<template>
  <main class="collection-page mx-auto max-w-[1440px] px-6 py-10 sm:px-8 lg:px-16">
    <header class="mb-6"><p class="text-xs font-bold text-[#b4becc]">MARKETPLACE / SELL A CARD</p><h1 class="display-font mt-1 text-[40px] font-bold">{{ existing?'Edit listing':'Create listing' }}</h1><p class="mt-1">Choose your card, set your price and show buyers exactly what you are selling.</p><RouterLink to="/marketplace" class="mt-3 inline-block text-sm text-apricot">← Back to marketplace</RouterLink></header>
    <p v-if="loading" role="status">Loading your cards…</p><p v-if="error" role="alert" class="mb-5 text-red-200">{{ error }}</p>
    <div v-if="!loading&&!entries.length" class="market-panel text-center"><h2 class="display-font text-xl font-bold">No unlisted cards available</h2><p class="mt-3 text-sm text-[#b4becc]">Add a card to your collection, or edit an existing sale listing.</p><RouterLink to="/my-collection" class="market-button mt-5 inline-block">View collection →</RouterLink><RouterLink to="/marketplace?tab=mine" class="ml-4 text-apricot underline">My listings</RouterLink></div>
    <form v-else-if="!loading" class="grid items-start gap-8 lg:grid-cols-[2fr_1fr]" @submit.prevent="submit">
      <fieldset :disabled="saving" class="min-w-0 space-y-6 disabled:opacity-60">
        <section class="market-panel"><h2 class="display-font text-[22px] font-bold">01 Your card</h2><label class="mt-4 block text-sm">Card from your collection<select v-model="entryId" :disabled="!!existing" class="market-field mt-2" required @change="chooseCard"><option v-for="entry in entries" :key="entry.id" :value="entry.id">{{ entry.name }} · {{ entry.setName }} · {{ entry.variant }} · {{ entry.condition }}</option></select></label><template v-if="selected"><p class="mt-3 text-sm text-apricot">{{ selected.variant }} · {{ selected.language }} · {{ selected.condition }} · {{ selected.quantity }} available</p><label class="mt-4 block text-sm">Quantity to sell<input v-model.number="form.quantity" required min="1" :max="selected.quantity" type="number" class="market-field mt-2" /></label></template>
          <label class="mt-4 block text-sm">Photos of the front and back <span class="text-linen/50">(optional, up to 4)</span><input :disabled="photos.length===4" accept="image/jpeg,image/png,image/webp" multiple type="file" class="market-field mt-2" @change="choosePhotos" /></label><p class="mt-2 text-xs text-[#b4becc]">JPG, PNG or WebP · up to 5 MB each. Photos are visible to buyers.</p>
          <div class="mt-3 flex flex-wrap gap-3"><div v-for="photo in photos" :key="photo.path"><img :src="photo.url" alt="Existing listing photo" class="h-28 w-20 rounded-lg object-contain" /><button type="button" class="mt-1 text-xs text-apricot underline" @click="photos=photos.filter(item=>item.path!==photo.path)">Remove photo</button></div><img v-for="url in previews" :key="url" :src="url" alt="New listing photo preview" class="h-28 w-20 rounded-lg object-contain" /></div>
          <label class="mt-4 block text-sm">Description<textarea v-model="form.description" maxlength="2000" placeholder="Describe any scratches, wear or other imperfections…" class="market-field mt-2 min-h-28"></textarea></label>
        </section>
        <section class="market-panel"><h2 class="display-font text-[22px] font-bold">02 Set your price</h2><label class="mt-4 block text-sm">Your price per card (EUR)<input v-model="form.price" required inputmode="decimal" placeholder="0.00" class="market-field mt-2 text-2xl" /></label>
          <p class="mt-4 text-sm">{{ estimate===null?'Market estimate unavailable':`Market estimate: ${formatMoney(Math.round(estimate*100))}` }}</p>
          <div v-if="ratio!==null" class="mt-5"><div class="relative my-6 h-2 rounded-full bg-lilac/40" role="img" :aria-label="`${ratio.toFixed(1)} percent of the market estimate`"><div class="absolute left-0 h-2 rounded-l-full bg-mint/50" :style="{width:`${100/Math.max(200,ratio+30)*100}%`}"></div><span class="absolute -top-3 h-8 w-px bg-linen" :style="{left:`${100/Math.max(200,ratio+30)*100}%`}"></span><span class="absolute -top-2 h-6 w-6 -translate-x-1/2 rounded-full border-2 border-linen bg-lilac shadow-lg" :style="{left:`${ratio/Math.max(200,ratio+30)*100}%`}"></span></div><div class="mt-2 flex justify-between text-xs text-[#b4becc]"><span>Below market</span><span>Market estimate</span><span>Above market</span></div><p class="display-font mt-4 text-xl font-bold text-lilac">{{ ratio.toFixed(1) }}% of the market estimate</p><p class="mt-2 text-sm text-[#b4becc]">{{ formatMoney(Math.abs(amount-Math.round(estimate*100))) }} {{ ratio>=100?'above':'below' }} the estimate per card.</p></div>
          <p class="mt-4 text-xs leading-5 text-[#b4becc]">You set the asking price. Cardmarket estimates in EUR via TCGdex are indicative and do not account for condition or language. Shipping is separate.</p>
        </section>
      </fieldset>
      <fieldset :disabled="saving" class="market-panel min-w-0 lg:sticky lg:top-6"><h2 class="display-font text-[22px] font-bold">Your listing</h2><div v-if="selected" class="mt-5 rounded-2xl border border-[#3b4a5d] p-4"><img v-if="selected.image&&!imageFailed" :src="selected.image" :alt="selected.name" class="mx-auto h-[218px] w-full object-contain" @error="imageFailed=true" /><p class="display-font mt-3 text-lg font-bold">{{ selected.name }}</p><p class="mt-2 text-xs text-[#b4becc]">{{ selected.variant }} · {{ selected.language }} · {{ selected.condition }}</p><p class="mt-3 font-bold">{{ amount===null?'Enter your price':formatMoney(amount) }} <span class="text-xs font-normal">per card · {{ form.quantity }} {{ form.quantity === 1 ? 'card' : 'cards' }}</span></p><p class="mt-2 text-xs text-[#b4becc]">Catalogue image · actual photos shown separately</p></div>
        <label class="mt-5 block text-sm">Delivery<select v-model="form.delivery" class="market-field mt-2"><option value="tracked">Tracked shipping</option><option value="pickup">Local pickup</option></select></label><label v-if="form.delivery==='tracked'" class="mt-4 block text-sm">Shipping paid by buyer (EUR)<input v-model="form.shipping" required inputmode="decimal" placeholder="0.00" class="market-field mt-2" /></label><p class="mt-5 font-bold">Buyer total: {{ total===null?'—':formatMoney(total) }}</p><p class="mt-2 text-xs text-[#b4becc]">{{ form.quantity }} {{ form.quantity === 1 ? 'card' : 'cards' }} · {{ form.delivery === 'pickup' ? 'local pickup, no shipping charge' : 'one shipping charge' }}.</p><button :disabled="saving||!selected" type="submit" class="market-button mt-6">{{ saving?'Saving…':existing?'Save changes':'Publish listing' }}</button>
      </fieldset>
    </form>
  </main>
</template>
