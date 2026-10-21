<template>
  <main class="relative isolate min-h-[calc(100vh-73px)] overflow-clip px-6 py-10 sm:px-8">
    <div class="pointer-events-none absolute -left-32 top-8 -z-10 h-96 w-96 rounded-full bg-lilac/10 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-40 right-0 -z-10 h-96 w-96 rounded-full bg-apricot/10 blur-3xl"></div>

    <div class="mx-auto max-w-6xl">
      <header class="mb-6">
        <p class="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-mint">Your collector profile</p>
        <h1 class="text-3xl font-bold tracking-tight text-linen sm:text-4xl">My profile</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-linen/55">
          Your collector profile and reputation among other collectors, sellers, and traders.
        </p>
        <p v-if="profileMessage" role="status" class="mt-3 text-sm text-mint">{{ profileMessage }}</p>
      </header>

      <section class="mb-6 rounded-2xl border border-white/10 bg-panel/90 p-6 shadow-xl shadow-black/10 sm:p-8">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-apricot text-2xl font-black text-ink shadow-lg shadow-apricot/15">
            {{ initials }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 class="text-2xl font-bold text-linen">{{ profile.displayName || 'Your profile' }}</h2>
              <span class="rounded-full bg-mint/15 px-3 py-1 text-xs font-semibold text-mint">Active collector</span>
            </div>
            <p class="mt-2 text-sm text-linen/55">{{ profile.location || 'Location not set' }} · Member since {{ memberSince }}</p>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-linen/70">
              {{ profile.bio || 'Add a short description about your collection.' }}
            </p>
            <div class="mt-4 flex flex-wrap gap-3">
              <button :aria-expanded="isEditing" aria-controls="profile-editor" class="rounded-xl bg-apricot px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-apricot/90 focus:outline-none focus:ring-2 focus:ring-apricot/50" type="button" @click="isEditing ? isEditing = false : openEditor()">
                Edit profile
              </button>
              <RouterLink :to="`/collectors/${auth.currentUser?.uid}`" class="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-linen transition hover:border-lilac hover:text-lilac focus:outline-none focus:ring-2 focus:ring-lilac/50">
                View public profile
              </RouterLink>
              <button
                v-if="isAdminAccount"
                class="rounded-xl border border-lilac/30 px-4 py-2.5 text-sm font-semibold text-lilac transition hover:bg-lilac/10 focus:outline-none focus:ring-2 focus:ring-lilac/50"
                type="button"
                @click="router.push('/admin')"
              >
                Admin dashboard
              </button>
              <button class="rounded-xl border border-apricot/30 px-4 py-2.5 text-sm font-semibold text-apricot transition hover:bg-apricot/10 focus:outline-none focus:ring-2 focus:ring-apricot/50 disabled:cursor-not-allowed disabled:opacity-60" type="button" :disabled="isSigningOut" @click="signOutUser">
                {{ isSigningOut ? 'Signing out…' : 'Sign out' }}
              </button>
            </div>
            <form v-if="isEditing" id="profile-editor" ref="profileEditor" tabindex="-1" class="mt-7 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-2" @submit.prevent="saveProfile">
              <label class="text-sm font-medium text-linen/80">Display name<input v-model="editForm.displayName" class="mt-2 w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none focus:border-lilac" required type="text" /></label>
              <label class="text-sm font-medium text-linen/80">Location<input v-model="editForm.location" class="mt-2 w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none focus:border-lilac" type="text" /></label>
              <label class="text-sm font-medium text-linen/80 sm:col-span-2">Bio<textarea v-model="editForm.bio" class="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none focus:border-lilac" maxlength="280"></textarea></label>
              <fieldset id="profile-visibility" ref="visibilitySettings" tabindex="-1" class="scroll-mt-6 space-y-3 rounded-xl bg-ink/60 p-4 text-sm outline-none focus:ring-2 focus:ring-lilac/50 sm:col-span-2">
                <legend class="px-2 font-bold">Public visibility</legend>
                <label class="flex items-center gap-3"><input v-model="editForm.publicProfile" type="checkbox" /> Publish my display name, location and bio</label>
                <label class="flex items-center gap-3"><input v-model="editForm.collectionPublic" type="checkbox" :disabled="!editForm.publicProfile" /> Make my entire collection public</label>
                <label class="flex items-center gap-3"><input v-model="editForm.tradesPublic" type="checkbox" :disabled="!editForm.publicProfile || editForm.collectionPublic" /> Share only cards marked for trade when my collection is private</label>
                <p class="text-xs leading-5 text-linen/60">Public cards include quantities, variants, condition and language. Your wishlist and account email stay private. Active sale listings remain public.</p>
              </fieldset>
              <p v-if="profileError" class="text-sm text-red-200 sm:col-span-2" role="alert">{{ profileError }}</p>
              <button class="rounded-xl bg-lilac px-4 py-3 font-bold text-ink sm:col-span-2" :disabled="isSaving" type="submit">{{ isSaving ? 'Saving…' : 'Save profile' }}</button>
            </form>
          </div>
        </div>

        <div class="mt-7 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
          <div>
            <p class="text-2xl font-bold text-apricot">—</p>
            <p class="mt-1 text-xs text-linen/50">Rating</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-linen">—</p>
            <p class="mt-1 text-xs text-linen/50">Transactions</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-linen">{{ completedTrades }}</p>
            <p class="mt-1 text-xs text-linen/50">Completed trades</p>
          </div>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
        <section class="overflow-hidden rounded-2xl border border-white/10 bg-panel/85">
          <div class="border-b border-white/10 px-6 py-5 sm:px-7">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-xl font-bold text-linen">Reviews</h2>
                <p class="mt-1 text-sm text-linen/50">Feedback from completed transactions.</p>
              </div>
              <span class="rounded-full bg-lilac/15 px-3 py-1 text-xs font-bold text-lilac">0 reviews</span>
            </div>
            <div class="mt-5 flex flex-wrap gap-2">
              <button class="rounded-lg bg-apricot px-3 py-2 text-xs font-bold text-ink">All · 0</button>
              <button class="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-linen/50" disabled>Buy and sell</button>
              <button class="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-linen/50" disabled>Trades</button>
            </div>
          </div>
          <div class="px-6 py-16 text-center sm:px-7">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-lilac/10 text-xl text-lilac">✦</div>
            <h3 class="mt-4 text-lg font-semibold text-linen">No reviews</h3>
            <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-linen/50">
              Reviews are not available yet. You can track your trade proposals and completed exchanges on the Trading page.
            </p>
          </div>
        </section>

        <aside class="space-y-6">
          <section class="rounded-2xl border border-white/10 bg-panel/85 p-6">
            <h2 class="text-lg font-bold text-linen">My cards</h2>
            <RouterLink to="/my-collection" class="mt-4 block text-sm font-semibold text-apricot hover:underline">My collection →</RouterLink>
            <div class="mt-3 flex items-center justify-between text-sm text-linen/55">
              <RouterLink to="/marketplace?tab=mine" class="hover:text-apricot">Listings ({{ listingCount }})</RouterLink>
              <RouterLink to="/trading" class="hover:text-apricot">Trading →</RouterLink>
            </div>
          </section>

          <section class="rounded-2xl border border-white/10 bg-panel/85 p-6">
            <h2 class="text-lg font-bold text-linen">Groups and interests</h2>
            <div class="mt-4 space-y-3 text-sm">
              <p class="font-semibold text-lilac">Pokémon Denmark</p>
              <p class="font-semibold text-lilac">Charizard collectors</p>
              <p class="text-apricot">Find groups →</p>
            </div>
          </section>

          <section class="rounded-2xl border border-white/10 bg-panel/85 p-6">
            <h2 class="text-lg font-bold text-linen">Visible only to you</h2>
            <div class="mt-4 space-y-2 text-sm">
              <div class="flex min-h-12 w-full items-center justify-between gap-4 rounded-lg bg-ink/40 px-3 py-3 text-left text-linen/65">
                <span>Account and security</span>
                <span aria-hidden="true" class="shrink-0 text-linen/40">→</span>
              </div>
              <div class="flex min-h-12 w-full items-center justify-between gap-4 rounded-lg bg-ink/40 px-3 py-3 text-left text-linen/65">
                <span>Notifications</span>
                <span aria-hidden="true" class="shrink-0 text-linen/40">→</span>
              </div>
              <button type="button" :aria-expanded="isEditing" aria-controls="profile-visibility" class="flex min-h-12 w-full items-center justify-between gap-4 rounded-lg bg-ink/40 px-3 py-3 text-left text-linen/65 transition-colors hover:bg-ink/60 hover:text-linen focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot" @click="openEditor('privacy')"><span>Profile visibility and privacy</span><span aria-hidden="true" class="shrink-0 text-linen/40">→</span></button>
              <p class="px-3 pt-2 text-xs leading-5 text-linen/40">Your address and contact details are not shown publicly.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { RouterLink, useRouter } from 'vue-router'
import { auth, db } from '../firebase'
import { listListings } from '@/services/marketplace'
import { getPublicProfile, saveProfileDetails } from '@/services/profiles'
import { watchTrades } from '@/services/trading'

const router = useRouter()
const listingCount = ref('—')
const completedTrades = ref('—')
let stopTrades
const profile = reactive({ displayName: '', location: '', bio: '', createdAt: null })
const editForm = reactive({ displayName: '', location: '', bio: '', publicProfile: false, collectionPublic: false, tradesPublic: false })
const isEditing = ref(false)
const isSaving = ref(false)
const isSigningOut = ref(false)
const profileError = ref('')
const profileMessage = ref('')
const profileEditor = ref(null)
const visibilitySettings = ref(null)

async function openEditor(section = 'profile') {
  isEditing.value = true
  profileMessage.value = ''
  await nextTick()
  // Let the expanded form finish layout before jumping away from the sidebar.
  await new Promise(resolve => requestAnimationFrame(resolve))
  const target = section === 'privacy' ? visibilitySettings.value : profileEditor.value
  target?.scrollIntoView({ behavior: 'instant', block: 'start' })
  target?.focus({ preventScroll: true })
}
const memberSince = computed(() => profile.createdAt?.toDate?.().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) || 'recently')
const initials = computed(() => profile.displayName.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'P')
const isAdminAccount = computed(() => auth.currentUser?.email?.toLowerCase() === 'admin@example.dk')

const loadProfile = async () => {
  if (!auth.currentUser) return
  const snapshot = await getDoc(doc(db, 'profiles', auth.currentUser.uid))
  if (snapshot.exists()) Object.assign(profile, snapshot.data())
  Object.assign(editForm, profile)
  const published = await getPublicProfile(auth.currentUser.uid)
  editForm.publicProfile = !!published
  editForm.collectionPublic = published?.collectionPublic === true
  editForm.tradesPublic = published?.tradesPublic === true
}

const saveProfile = async () => {
  if (!auth.currentUser) return
  isSaving.value = true
  profileError.value = ''
  try {
    const values = { displayName: editForm.displayName.trim(), location: editForm.location.trim(), bio: editForm.bio.trim() }
    await saveProfileDetails({ ...editForm, ...values })
    Object.assign(profile, values)
    isEditing.value = false
    profileMessage.value = editForm.publicProfile ? 'Profile saved. Your profile is public.' : 'Profile saved. Your profile is private.'
  } catch (error) {
    profileError.value = error.message
  } finally {
    isSaving.value = false
  }
}

const signOutUser = async () => {
  isSigningOut.value = true
  profileError.value = ''

  try {
    await signOut(auth)
    await router.push('/login')
  } catch (error) {
    profileError.value = error.message
  } finally {
    isSigningOut.value = false
  }
}

onMounted(() => {
  stopTrades = watchTrades(trades => { completedTrades.value = trades.filter(trade => trade.status === 'completed').length }, () => { completedTrades.value = '—' })
  loadProfile().catch(error => { profileError.value = error.message; isEditing.value = true })
  listListings(true).then(listings => { listingCount.value = listings.filter(listing => listing.status === 'active').length }).catch(() => { listingCount.value = '—' })
})
onBeforeUnmount(() => stopTrades?.())
</script>
