import { createRouter, createWebHistory } from 'vue-router'

import { auth } from '../firebase.js';
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import adminView from '../views/adminView.vue'

function waitforAuthState() {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
        {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
      {
      path: '/admin',
      name: 'admin',
      component: adminView, 
      meta: { requiresAuth: true },
    },
  ],
})

export default router
