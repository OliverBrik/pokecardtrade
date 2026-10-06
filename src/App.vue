<script setup>
import { RouterView } from 'vue-router'
import AppNavigation from './components/AppNavigation.vue'
</script>

<template>
<<<<<<< HEAD
  <AppNavigation />
=======
  <header class="border-b border-white/10 bg-panel">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
      <nav>
        <RouterLink class="text-sm font-semibold text-linen" to="/">Home</RouterLink>
        <RouterLink class="text-sm font-semibold text-linen" to="/login">Login</RouterLink>
        <RouterLink class="text-sm font-semibold text-linen" to="/profile">Profil</RouterLink>
      </nav>
    </div>
  </header>
>>>>>>> d3984075b04df3a02300775657bb78aa434ad146

  <RouterView />
</template>
