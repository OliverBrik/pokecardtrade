<script setup>
import { conditions, languages } from '@/services/collection'
const preferences = defineModel({ type: Object, required: true })
</script>

<template>
  <fieldset class="grid gap-3 sm:grid-cols-2">
    <legend class="mb-3 text-sm font-bold">Wishlist preferences</legend>
    <label class="text-sm">Variant<select v-model="preferences.variant" class="market-field mt-2"><option value="">Any variant</option><option v-for="variant in ['normal', 'holo', 'reverse', 'firstEdition', 'wPromo']" :key="variant">{{ variant }}</option></select></label>
    <label class="text-sm">Language<select v-model="preferences.language" class="market-field mt-2"><option value="">Any language</option><option v-for="language in languages" :key="language">{{ language }}</option></select></label>
    <label class="text-sm sm:col-span-2">Minimum condition<select v-model="preferences.minimumCondition" class="market-field mt-2"><option v-for="condition in conditions" :key="condition" :value="condition">{{ condition === 'Damaged' ? 'Any condition' : `${condition} or better` }}</option></select></label>
  </fieldset>
</template>
