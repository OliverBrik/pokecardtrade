<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { formatMoney } from '@/services/marketplace'
defineProps({ listing: { type: Object, required: true } })
const failed = ref(false)
</script>
<template>
  <RouterLink :to="`/marketplace/${listing.id}`" class="flex min-w-0 flex-col gap-2 rounded-2xl border border-[#3b4a5d] bg-panel p-4 transition hover:border-apricot focus-visible:outline-2 focus-visible:outline-apricot">
    <div class="flex h-[218px] items-center justify-center"><img v-if="!failed && listing.image" :src="listing.image" :alt="listing.name" class="h-full w-full object-contain" loading="lazy" @error="failed = true" /><span v-else class="text-sm text-linen/60">Image unavailable</span></div>
    <h3 class="display-font text-lg font-bold">{{ listing.name }}</h3>
    <p class="text-xs text-[#b4becc]">{{ listing.condition }} · {{ listing.language }} · {{ listing.variant }}</p>
    <p class="display-font mt-auto text-lg font-bold">{{ formatMoney(listing.priceCents) }} <span class="text-xs font-normal">each · {{ listing.delivery === 'pickup' ? 'Pickup' : `+ ${formatMoney(listing.shippingCents)} shipping` }}</span></p>
    <p class="text-[13px] text-apricot">Seller: {{ listing.sellerName }} →</p><p v-if="listing.status !== 'active'" class="text-xs uppercase text-lilac">{{ listing.status }}</p>
  </RouterLink>
</template>
