import { createRouter, createWebHistory } from 'vue-router'

import { auth } from '../firebase.js';

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
    { path: '/trading', name: 'trading', component: () => import('../views/TradingView.vue'), meta: { requiresAuth: true } },
    { path: '/collectors/:uid', name: 'public-profile', component: () => import('../views/PublicProfileView.vue') },
    { path: '/marketplace', name: 'marketplace', component: () => import('../views/MarketplaceView.vue') },
    { path: '/marketplace/create', name: 'create-listing', component: () => import('../views/CreateListingView.vue'), meta: { requiresAuth: true } },
    { path: '/marketplace/:id/edit', name: 'edit-listing', component: () => import('../views/CreateListingView.vue'), meta: { requiresAuth: true } },
    { path: '/marketplace/:id', name: 'listing', component: () => import('../views/ListingDetailView.vue') },
    { path: '/messages', name: 'messages', component: () => import('../views/MessagesView.vue'), meta: { requiresAuth: true } },
    {
      path: '/my-collection',
      name: 'my-collection',
      component: () => import('../views/MyCollectionView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      name: 'explore',
      component: () => import('../views/ExploreView.vue'),
    },
        {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
      {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/adminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
      {
        path: '/profile',
        name: 'profile',
        component: () => import('../views/ProfileView.vue'),
        meta: { requiresAuth: true },
      },
  ],
})

router.beforeEach(async (to) => {
  const user = await waitforAuthState()
  if (!user) {
    if (to.meta.requiresAuth) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    return true
  }

  const tokenResult = await user.getIdTokenResult(true)
  const isAdmin = tokenResult.claims.admin === true

  if (to.meta.requiresAdmin && !isAdmin) {
    return { name: 'explore' }
  }

  if (isAdmin && (to.name === 'profile' || to.name === 'login')) {
    return { name: 'admin' }
  }

  return true
})

export default router
