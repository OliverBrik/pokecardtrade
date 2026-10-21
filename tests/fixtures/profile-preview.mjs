/* global __PROFILE_UI_FIXTURE__ */
import { createApp, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ProfileView from '../../src/views/ProfileView.vue'
import '../../src/assets/main.css'
if (typeof __PROFILE_UI_FIXTURE__ === 'undefined' || !__PROFILE_UI_FIXTURE__) throw new Error('Run Vite with tests/profile-preview.config.mjs for this isolated fixture.')
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/profile', component: ProfileView }] })
await router.push('/profile')
createApp({ render: () => [h('p', { class: 'bg-apricot p-2 text-center text-xs text-ink' }, 'ISOLATED PROFILE UI TEST · Synthetic data · No Firebase connection'), h(ProfileView)] }).use(router).mount('#app')
