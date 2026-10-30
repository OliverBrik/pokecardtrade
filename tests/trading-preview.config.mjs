// Isolated browser fixture. This configuration is never loaded by the app build.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
const path = relative => fileURLToPath(new URL(relative, import.meta.url))
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: { __TRADING_UI_FIXTURE__: 'true' },
  optimizeDeps: { entries: ['tests/trading-preview.html'] },
  resolve: { alias: [
    ...['@/firebase', '@/services/collection', '@/services/trading', '@/services/profiles', '@/services/goals'].map(find => ({ find, replacement: path('./fixtures/trading-data.mjs') })),
    { find: '@', replacement: path('../src') },
  ] },
})
