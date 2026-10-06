<script setup>
import { RouterView } from 'vue-router'
import AppNavigation from './components/AppNavigation.vue'
</script>

<template>
  <AppNavigation profile-to="/profile" />

  <RouterView />
</template>
