<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { auth } from '@/firebase'
import { addOwnedCard, addWishlistCard, conditions, languages, variantsFor } from '@/services/collection'

const props = defineProps({ card: { type: Object, required: true } })
const emit = defineEmits(['saved'])
const router = useRouter()
const saving = ref(false)
const error = ref('')
const message = ref('')
const form = reactive({ quantity: 1, variant: '', language: 'English', condition: 'Near Mint' })
const variants = computed(() => variantsFor(props.card))
watch(() => props.card.id, () => {
  Object.assign(form, { quantity: 1, variant: variants.value[0] ?? '', language: 'English', condition: 'Near Mint' })
  error.value = message.value = ''
}, { immediate: true })

async function save(wishlist = false) {
  if (!auth.currentUser) {
    await router.push({ name: 'login', query: { redirect: `/my-collection?add=${encodeURIComponent(props.card.id)}` } })
    return
  }
  saving.value = true
  error.value = message.value = ''
  try {
    if (wishlist) await addWishlistCard(props.card)
    else await addOwnedCard(props.card, { ...form })
    message.value = wishlist ? 'Saved to your wishlist.' : 'Added to your collection.'
    emit('saved')
  } catch (cause) { error.value = cause.message || 'Could not save this card. Please try again.' }
  finally { saving.value = false }
}
</script>

<template>
  <section aria-label="Save this card" class="mt-6 border-t border-white/10 pt-5">
    <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="save(false)">
      <label class="text-sm text-[#b4becc]">Quantity<input v-model.number="form.quantity" type="number" required min="1" max="9999" class="mt-1 min-h-11 w-full rounded-lg border border-[#3b4a5d] bg-ink px-3 text-linen" /></label>
      <label class="text-sm text-[#b4becc]">Variant<select v-model="form.variant" required class="mt-1 min-h-11 w-full rounded-lg border border-[#3b4a5d] bg-ink px-3 text-linen"><option v-if="!variants.length" value="">Variant unavailable</option><option v-for="variant in variants" :key="variant">{{ variant }}</option></select></label>
      <label class="text-sm text-[#b4becc]">Language<select v-model="form.language" class="mt-1 min-h-11 w-full rounded-lg border border-[#3b4a5d] bg-ink px-3 text-linen"><option v-for="language in languages" :key="language">{{ language }}</option></select></label>
      <label class="text-sm text-[#b4becc]">Condition<select v-model="form.condition" class="mt-1 min-h-11 w-full rounded-lg border border-[#3b4a5d] bg-ink px-3 text-linen"><option v-for="condition in conditions" :key="condition">{{ condition }}</option></select></label>
      <button :disabled="saving || !variants.length" type="submit" class="rounded-lg bg-apricot px-4 py-3 text-sm font-bold text-ink disabled:opacity-50 sm:col-span-2">{{ saving ? 'Saving…' : '+ Add to collection' }}</button>
      <button :disabled="saving" type="button" class="rounded-lg border border-[#3b4a5d] px-4 py-3 text-sm font-bold text-lilac disabled:opacity-50 sm:col-span-2" @click="save(true)">♡ Add to wishlist</button>
    </form>
    <p v-if="error" role="alert" class="mt-3 text-sm text-red-200">{{ error }}</p>
    <p v-if="message" role="status" class="mt-3 text-sm text-mint">{{ message }} <RouterLink to="/my-collection" class="underline">View collection →</RouterLink></p>
  </section>
</template>
