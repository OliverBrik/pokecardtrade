<script setup>
import { ref } from 'vue'
defineProps({ entry: { type: Object, required: true }, price: { type: String, default: '' }, wishlist: Boolean })
defineEmits(['manage'])
const failedImage = ref(false)
</script>

<template>
  <button type="button" class="flex min-w-0 flex-col gap-2 rounded-2xl border border-[#3b4a5d] bg-panel p-4 text-left transition hover:border-apricot focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot" @click="$emit('manage', entry)">
    <div class="flex h-[218px] w-full items-center justify-center overflow-hidden rounded-xl">
      <img v-if="entry.image && !failedImage" :src="entry.image" :alt="entry.name" class="h-full w-full object-contain" loading="lazy" @error="failedImage = true" />
      <span v-else class="text-sm text-[#b4becc]">Image unavailable</span>
    </div>
    <h3 class="display-font text-lg font-bold">{{ entry.name }}</h3>
    <p class="text-xs text-[#b4becc]">{{ wishlist ? entry.setName : `${entry.variant} · ${entry.language} · ${entry.condition}` }}</p>
    <p class="display-font mt-auto text-lg font-bold">{{ wishlist ? 'On your wishlist' : `${entry.quantity} ${entry.quantity === 1 ? 'card' : 'cards'} · ${price}` }}</p>
    <p class="text-[13px] text-apricot">{{ wishlist ? 'Manage wishlist →' : entry.forTrade ? 'For trade · Manage card →' : 'Manage card →' }}</p>
  </button>
</template>
