<script setup>
import { ref, useId, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

defineProps({
  // Set a destination when each page is ready.
  links: {
    type: Array,
    default: () => [
      { label: 'Explore', to: '/' },
      { label: 'My collection', to: '/my-collection' },
      { label: 'Marketplace', to: null },
      { label: 'Trading', to: null },
    ],
  },
  messagesTo: { type: [String, Object], default: null },
  profileTo: { type: [String, Object], default: '/login' },
})

const route = useRoute()
const menuOpen = ref(false)
const menuId = useId()
const menuToggle = ref(null)

watch(() => route.fullPath, () => { menuOpen.value = false })

function closeMenu(event) {
  if (!menuOpen.value) return
  menuOpen.value = false
  menuToggle.value?.focus()
  event.stopPropagation()
}
</script>

<template>
  <header class="bg-ink text-linen" @keydown.esc="closeMenu">
    <nav
      aria-label="Main navigation"
      class="mx-auto flex min-h-[86px] max-w-[1320px] flex-wrap items-center gap-x-7 px-6 py-4 sm:px-8 lg:flex-nowrap lg:px-10"
    >
      <RouterLink
        to="/"
        aria-label="Kardvia home"
        class="flex shrink-0 items-center gap-6 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot"
        @click="menuOpen = false"
      >

        <span class="text-[28px] font-bold leading-none tracking-tight">kardvia</span>
      </RouterLink>

      <button
        ref="menuToggle"
        type="button"
        :aria-expanded="menuOpen"
        :aria-controls="menuId"
        :aria-label="menuOpen ? 'Close navigation menu' : 'Open navigation menu'"
        class="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-linen hover:bg-panel focus-visible:outline-2 focus-visible:outline-apricot lg:hidden"
        @click="menuOpen = !menuOpen"
      >
        <svg aria-hidden="true" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path v-if="menuOpen" d="m6 6 12 12M6 18 18 6" />
          <path v-else d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div
        :id="menuId"
        :class="menuOpen ? 'flex' : 'hidden'"
        class="w-full flex-col gap-4 pt-5 lg:flex lg:w-auto lg:flex-1 lg:flex-row lg:items-center lg:gap-7 lg:pt-0"
      >
        <ul class="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-8">
          <li v-for="link in links" :key="link.label">
            <RouterLink
              v-if="link.to"
              :to="link.to"
              :class="route.path === link.to ? 'font-bold text-apricot' : 'text-linen/80'"
              class="block rounded-sm py-2 text-base whitespace-nowrap transition-colors hover:text-apricot focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot"
              @click="menuOpen = false"
            >{{ link.label }}</RouterLink>
            <span v-else aria-disabled="true" title="Coming soon" class="block cursor-default py-2 text-base whitespace-nowrap text-linen/80">{{ link.label }}</span>
          </li>
        </ul>

        <div class="flex items-center gap-7 border-t border-linen/10 pt-4 lg:ml-auto lg:border-0 lg:pt-0">
          <RouterLink
            v-if="messagesTo"
            :to="messagesTo"
            class="rounded-sm py-2 text-sm text-linen/70 transition-colors hover:text-apricot focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot"
            @click="menuOpen = false"
          >Messages</RouterLink>
          <span v-else aria-disabled="true" title="Coming soon" class="cursor-default py-2 text-sm text-linen/70">Messages</span>
          <RouterLink
            :to="profileTo"
            class="inline-flex min-h-11 items-center justify-center rounded-full bg-panel px-7 py-3 text-sm font-bold whitespace-nowrap transition-colors hover:bg-linen/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot"
            @click="menuOpen = false"
          >My profile</RouterLink>
        </div>
      </div>
    </nav>
  </header>
</template>
