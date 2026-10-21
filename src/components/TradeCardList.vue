<script setup>
import { ref } from 'vue'
defineProps({ cards: { type: Array, required: true }, selectable: Boolean })
const selection = defineModel({ type: Object, default: () => ({}) })
const failed = ref(new Set())
</script>

<template>
  <ul class="space-y-3">
    <li v-for="card in cards" :key="card.entryId" class="flex min-w-0 items-start gap-3 rounded-xl border border-linen/10 bg-ink/40 p-3">
      <img v-if="card.image && !failed.has(card.entryId)" :src="card.image" :alt="card.name" loading="lazy" class="h-20 w-14 shrink-0 object-contain" @error="failed.add(card.entryId)" />
      <div class="min-w-0 flex-1">
        <p class="font-bold">{{ card.name }}</p>
        <p class="mt-1 text-xs text-linen/60">{{ card.setName }} · #{{ card.localId }}</p>
        <p class="mt-1 text-xs text-linen/60">{{ card.variant }} · {{ card.language }} · {{ card.condition }}</p>
        <label v-if="selectable" class="mt-3 flex flex-wrap items-center gap-2 text-sm"><input type="checkbox" :checked="selection[card.entryId] !== undefined" class="h-4 w-4 accent-apricot" @change="$event.target.checked ? selection[card.entryId] = 1 : delete selection[card.entryId]" /> Include {{ card.name }}<input v-if="selection[card.entryId] !== undefined" v-model.number="selection[card.entryId]" type="number" min="1" :max="card.quantity" required :aria-label="`Quantity of ${card.name}`" class="w-20 rounded-lg border border-linen/20 bg-ink px-2 py-1" /><span class="text-xs text-linen/50">{{ card.quantity }} available</span></label>
        <p v-else class="mt-2 text-sm text-mint">{{ card.quantity }} {{ card.quantity === 1 ? 'copy' : 'copies' }}</p>
      </div>
    </li>
  </ul>
</template>
