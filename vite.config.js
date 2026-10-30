import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

import { defineConfig, loadEnv } from 'vite'
import { validateFirebaseEnv } from './scripts/firebase-config.mjs'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const root = fileURLToPath(new URL('.', import.meta.url))
    const { projects } = JSON.parse(readFileSync(new URL('.firebaserc', import.meta.url), 'utf8'))
    validateFirebaseEnv(loadEnv(mode, root, 'VITE_'), projects.default)
  }
  return {
    plugins: [
      vue(),
      vueDevTools(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    build: {
      rollupOptions: {
        output: {
          onlyExplicitManualChunks: true,
          manualChunks(id) {
            if (id.includes('/node_modules/@firebase/firestore/')) return 'firebase-firestore'
            if (id.includes('/node_modules/@firebase/auth/')) return 'firebase-auth'
          },
        },
      },
    },
  }
})
