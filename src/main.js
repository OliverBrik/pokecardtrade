import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { installChunkRecovery } from './services/chunk-recovery'

installChunkRecovery(window)

const app = createApp(App)

app.use(router)

app.mount('#app')
