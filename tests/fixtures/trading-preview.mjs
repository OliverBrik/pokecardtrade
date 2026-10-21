/* global __TRADING_UI_FIXTURE__ */
import { createApp, h } from 'vue'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import TradingView from '../../src/views/TradingView.vue'
import AppNavigation from '../../src/components/AppNavigation.vue'
import '../../src/assets/main.css'
if (typeof __TRADING_UI_FIXTURE__ === 'undefined' || !__TRADING_UI_FIXTURE__) {
  throw new Error('This isolated fixture must be opened using npm run dev:trading-preview.')
}
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/trading', component: TradingView }] })
await router.push('/trading')
createApp({ render: () => [
  h('p', { class: 'bg-apricot p-2 text-center text-xs font-bold text-ink' }, 'ISOLATED UI TEST · Synthetic collectors · No Firebase connection'),
  h(AppNavigation), h(RouterView),
] }).use(router).mount('#app')
