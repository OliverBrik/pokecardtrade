<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { auth } from '@/firebase'
import { addOwnedCard, addWishlistCard, conditions, languages, variantsFor } from '@/services/collection'
import WishlistPreferences from '@/components/WishlistPreferences.vue'

const props = defineProps({ card: { type: Object, required: true } })
const emit = defineEmits(['saved'])
const router = useRouter()
const saving = ref(false)
const error = ref('')
const message = ref('')
const form = reactive({ quantity: 1, variant: '', language: 'English', condition: 'Near Mint' })
const wish = ref({ variant: '', language: '', minimumCondition: 'Damaged' })
const variants = computed(() => variantsFor(props.card))
watch(() => props.card.id, () => {
  Object.assign(form, { quantity: 1, variant: variants.value[0] ?? '', language: 'English', condition: 'Near Mint' })
  error.value = message.value = ''
  wish.value = { variant: '', language: '', minimumCondition: 'Damaged' }
}, { immediate: true })

async function save(wishlist = false) {
  if (!auth.currentUser) {
    await router.push({ name: 'login', query: { redirect: `/my-collection?add=${encodeURIComponent(props.card.id)}` } })
    return
  }
  saving.value = true
  error.value = message.value = ''
  try {
    if (wishlist) await addWishlistCard(props.card, wish.value)
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
    </form>
    <details class="mt-4 rounded-xl border border-[#3b4a5d] p-4"><summary class="cursor-pointer text-sm font-bold text-lilac">♡ Add to wishlist</summary><form class="mt-4" @submit.prevent="save(true)"><WishlistPreferences v-model="wish" /><button :disabled="saving" type="submit" class="mt-4 w-full rounded-lg bg-lilac px-4 py-3 text-sm font-bold text-ink disabled:opacity-50">{{ saving ? 'Saving…' : 'Save to wishlist' }}</button></form></details>
    <p v-if="error" role="alert" class="mt-3 text-sm text-red-200">{{ error }}</p>
    <p v-if="message" role="status" class="mt-3 text-sm text-mint">{{ message }} <RouterLink to="/my-collection" class="underline">View collection →</RouterLink></p>
  </section>
</template>
