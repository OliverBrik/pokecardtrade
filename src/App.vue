<script setup>
import { RouterLink, RouterView } from 'vue-router'

</script>

<template>
  <header class="border-b border-white/10 bg-panel">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
      <nav>
        <RouterLink class="text-sm font-semibold text-linen" to="/">Home</RouterLink>
        <RouterLink class="text-sm font-semibold text-linen" to="/login">Login</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView />
</template>

