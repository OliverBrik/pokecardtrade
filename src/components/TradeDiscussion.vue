<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { auth } from '@/firebase'
import { replyToTrade, watchTradeMessages } from '@/services/trading'
const props = defineProps({ tradeId: { type: String, required: true } })
const messages = ref([]), text = ref(''), sending = ref(false), loading = ref(true), error = ref('')
let stop
onMounted(() => {
  stop = watchTradeMessages(props.tradeId, data => { messages.value = data; loading.value = false }, () => {
    loading.value = false; error.value = 'Could not load the conversation. Close it and try again.'
  })
})
onBeforeUnmount(() => stop?.())
async function send() {
  sending.value = true; error.value = ''
  try { await replyToTrade(props.tradeId, text.value); text.value = '' }
  catch (cause) { error.value = cause.message || 'Could not send your message.' }
  finally { sending.value = false }
}
</script>

<template>
  <section aria-label="Private trade conversation" class="mt-4 rounded-xl border border-linen/10 bg-ink/30 p-4">
    <p v-if="loading" role="status" class="text-sm text-linen/60">Loading conversation…</p>
    <p v-else-if="!messages.length" class="text-sm text-linen/60">Use this private conversation to agree on delivery and check card condition.</p>
    <div aria-live="polite" class="max-h-80 space-y-3 overflow-y-auto"><p v-for="item in messages" :key="item.id" class="whitespace-pre-wrap break-words rounded-lg p-3 text-sm" :class="item.senderId === auth.currentUser?.uid ? 'ml-5 bg-lilac/15' : 'mr-5 bg-panel'"><span class="mb-1 block text-xs text-apricot">{{ item.senderId === auth.currentUser?.uid ? 'You' : 'Other collector' }}</span>{{ item.text }}</p></div>
    <p v-if="error" role="alert" class="mt-3 text-sm text-red-200">{{ error }}</p>
    <form class="mt-4" @submit.prevent="send"><label class="text-sm">Message<textarea v-model="text" required maxlength="2000" class="market-field mt-2 min-h-24" /></label><button :disabled="sending || !text.trim()" class="mt-3 rounded-lg bg-apricot px-4 py-3 text-sm font-bold text-ink disabled:opacity-50">{{ sending ? 'Sending…' : 'Send message' }}</button></form>
  </section>
</template>
