import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
const path = relative => fileURLToPath(new URL(relative, import.meta.url))
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: { __PROFILE_UI_FIXTURE__: 'true' },
  optimizeDeps: { entries: ['tests/profile-preview.html'] },
  resolve: { alias: [
    ...['../firebase', 'firebase/auth', 'firebase/firestore', '@/services/marketplace', '@/services/profiles', '@/services/trading'].map(find => ({ find, replacement: path('./fixtures/profile-data.mjs') })),
    { find: '@', replacement: path('../src') },
  ] },
})
