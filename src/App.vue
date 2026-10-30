<script setup>
import { RouterLink, RouterView } from 'vue-router'
import AppNavigation from './components/AppNavigation.vue'
import { onBeforeUnmount, ref } from 'vue'

const offline = ref(false)
function catalogueUnavailable() { offline.value = true }
function retryCatalogue() { window.location.reload() }
window.addEventListener('kardvia:catalogue-offline', catalogueUnavailable)
onBeforeUnmount(() => window.removeEventListener('kardvia:catalogue-offline', catalogueUnavailable))
</script>

<template>
  <AppNavigation />
  <aside v-if="offline" role="status" class="border-y border-apricot/30 bg-panel px-6 py-3 text-center text-sm leading-6 text-linen">Limited catalogue mode: the live card API is unavailable. Using saved data or the bundled 151 and Obsidian Flames checklists. Prices may be unavailable or out of date; card images still require an internet connection. <button class="ml-2 text-apricot underline" @click="retryCatalogue">Retry live data</button> · <RouterLink to="/demo" class="text-mint underline">Try the interactive trading demo →</RouterLink></aside>

  <RouterView :key="$route.path" />
</template>
