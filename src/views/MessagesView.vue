<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { auth } from '@/firebase'
import { reply, watchInquiries, watchMessages } from '@/services/inquiries'
const route=useRoute(),router=useRouter(),threads=ref([]),selected=ref(null),messages=ref([]),text=ref(''),error=ref(''),loading=ref(true),sending=ref(false)
let unsubscribe
let stopInbox
function open(thread){unsubscribe?.();selected.value=thread;messages.value=[];text.value='';error.value='';router.replace({query:{thread:thread.id}});unsubscribe=watchMessages(thread.id,data=>{messages.value=data},()=>{error.value='Could not load messages.'})}
async function send(){sending.value=true;error.value='';try{await reply(selected.value.id,text.value);text.value=''}catch(cause){error.value=cause.message}finally{sending.value=false}}
onMounted(()=>{
  stopInbox=watchInquiries(data=>{
    threads.value=data;loading.value=false
    if(!selected.value){const chosen=data.find(item=>item.id===route.query.thread)??data[0];if(chosen)open(chosen)}
  },()=>{error.value='Could not load conversations.';loading.value=false})
})
onBeforeUnmount(()=>{unsubscribe?.();stopInbox?.()})
</script>
<template>
  <main class="collection-page mx-auto max-w-[1440px] px-6 py-10 sm:px-8 lg:px-16"><h1 class="display-font text-4xl font-bold">Messages</h1><p class="mt-3 text-[#b4becc]">Private conversations about marketplace listings.</p><p v-if="error" role="alert" class="mt-5 text-red-200">{{ error }}</p><p v-if="loading" class="mt-6" role="status">Loading conversations…</p><p v-else-if="!threads.length" class="market-panel mt-6">No messages yet. <RouterLink to="/marketplace" class="text-apricot underline">Browse marketplace</RouterLink></p>
    <div v-else class="mt-6 grid items-start gap-6 md:grid-cols-[1fr_2fr]"><aside class="market-panel"><button v-for="thread in threads" :key="thread.id" :aria-pressed="selected?.id===thread.id" class="mb-3 block w-full rounded-lg p-3 text-left" :class="selected?.id===thread.id?'bg-apricot text-ink':'bg-ink'" @click="open(thread)">{{ thread.cardName }} <span class="block text-xs">{{ thread.sellerId===auth.currentUser?.uid?'Buyer enquiry':'Your enquiry' }}</span></button></aside><section v-if="selected" class="market-panel"><h2 class="display-font text-xl font-bold">{{ selected.cardName }}</h2><RouterLink :to="`/marketplace/${selected.listingId}`" class="mt-2 inline-block text-sm text-apricot">View listing →</RouterLink><div class="mt-5 max-h-[50vh] space-y-3 overflow-y-auto" aria-live="polite"><p v-for="message in messages" :key="message.id" class="whitespace-pre-wrap break-words rounded-lg p-4 text-sm" :class="message.senderId===auth.currentUser?.uid?'ml-8 bg-lilac/15':'mr-8 bg-ink'"><span class="mb-1 block text-xs text-apricot">{{ message.senderId===auth.currentUser?.uid?'You':'Other collector' }}</span>{{ message.text }}</p></div><form class="mt-5" @submit.prevent="send"><label class="text-sm">Reply<textarea v-model="text" required maxlength="2000" class="market-field mt-2 min-h-24" /></label><button :disabled="sending" class="market-button mt-3">{{ sending?'Sending…':'Send reply' }}</button></form></section></div>
  </main>
</template>
