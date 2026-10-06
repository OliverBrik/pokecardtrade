<template>
  <main class="relative isolate flex min-h-[calc(100vh-73px)] items-center justify-center overflow-hidden px-6 py-12 sm:px-8">
    <div class="pointer-events-none absolute -left-24 top-16 -z-10 h-72 w-72 rounded-full bg-lilac/15 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-32 -right-16 -z-10 h-96 w-96 rounded-full bg-apricot/10 blur-3xl"></div>

    <section class="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-panel/90 shadow-2xl shadow-black/30 backdrop-blur sm:grid-cols-[0.9fr_1.1fr]">
      <div class="relative hidden overflow-hidden bg-gradient-to-br from-lilac/20 via-panel to-mint/10 p-10 sm:flex sm:flex-col sm:justify-between">
        <div class="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-lilac/20"></div>
        <div class="absolute -bottom-16 -left-16 h-48 w-48 rounded-full border border-apricot/20"></div>

        <div class="relative">
          <div class="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-apricot text-xl font-black text-ink shadow-lg shadow-apricot/20">
            P
          </div>
          <p class="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-mint">Pokecard Trade</p>
          <h1 class="max-w-xs text-4xl font-bold leading-tight tracking-tight text-linen">
            Your collection, <span class="text-lilac">your way.</span>
          </h1>
        </div>

        <p class="relative max-w-xs text-sm leading-6 text-linen/60">
          Keep your cards organized and find the next great addition to your collection.
        </p>
      </div>

      <div class="p-7 sm:p-10">
        <div v-if="!isSignedIn">
          <div class="mb-8">
            <p class="mb-2 text-sm font-semibold text-apricot">{{ isRegistering ? 'Join the community' : 'Welcome back' }}</p>
            <h2 class="text-3xl font-bold tracking-tight text-linen">{{ isRegistering ? 'Create your profile' : 'Sign in to trade' }}</h2>
            <p class="mt-2 text-sm text-linen/55">{{ isRegistering ? 'Create an account to start collecting and trading.' : 'Enter your details to access your collection.' }}</p>
          </div>

          <form class="space-y-5" @submit.prevent="login">
            <div v-if="isRegistering">
              <label class="mb-2 block text-sm font-medium text-linen/80" for="display-name">Display name</label>
              <input id="display-name" v-model="displayName" class="w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none transition placeholder:text-linen/30 focus:border-lilac focus:ring-2 focus:ring-lilac/20" autocomplete="name" placeholder="KortMads" required type="text" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-linen/80" for="email">Email address</label>
              <input
                id="email"
                v-model="email"
                autocomplete="email"
                class="w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none transition placeholder:text-linen/30 focus:border-lilac focus:ring-2 focus:ring-lilac/20"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
            </div>

            <div>
              <div class="mb-2 flex items-center justify-between">
                <label class="block text-sm font-medium text-linen/80" for="password">Password</label>
                <span class="text-xs text-linen/40">Keep it safe</span>
              </div>
              <input
                id="password"
                v-model="password"
                autocomplete="current-password"
                class="w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none transition placeholder:text-linen/30 focus:border-lilac focus:ring-2 focus:ring-lilac/20"
                name="password"
                placeholder="Enter your password"
                required
                type="password"
              />
            </div>

            <p v-if="errorMessage" class="rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-5 text-red-200" role="alert">
              {{ errorMessage }}
            </p>

            <button
              class="flex w-full items-center justify-center rounded-xl bg-apricot px-4 py-3.5 font-bold text-ink transition hover:bg-apricot/90 focus:outline-none focus:ring-2 focus:ring-apricot focus:ring-offset-2 focus:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isLoading"
              type="submit"
            >
              <span v-if="isLoading" class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink"></span>
              {{ isLoading ? (isRegistering ? 'Creating account…' : 'Signing in…') : (isRegistering ? 'Create account' : 'Sign in') }}
            </button>
          </form>
          <button class="mt-5 w-full text-sm font-semibold text-lilac hover:text-linen" type="button" @click="toggleMode">
            {{ isRegistering ? 'Already have an account? Sign in' : 'Need an account? Create one' }}
          </button>
        </div>

        <div v-else class="flex min-h-80 flex-col justify-center">
          <p class="mb-2 text-sm font-semibold text-mint">You’re signed in</p>
          <h2 class="text-3xl font-bold tracking-tight text-linen">Welcome back!</h2>
          <p class="mt-3 break-all text-sm text-linen/60">{{ userEmail }}</p>
          <button
            class="mt-8 w-full rounded-xl border border-white/15 px-4 py-3.5 font-bold text-linen transition hover:border-apricot hover:text-apricot focus:outline-none focus:ring-2 focus:ring-apricot focus:ring-offset-2 focus:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isLoading"
            type="button"
            @click="logout"
          >
            {{ isLoading ? 'Signing out…' : 'Sign out' }}
          </button>
          <p v-if="errorMessage" class="mt-4 text-sm text-red-200" role="alert">{{ errorMessage }}</p>
        </div>
      </div>
    </section>
  </main>

</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { createUserWithEmailAndPassword, onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useRouter } from 'vue-router';
import { auth, db } from '../firebase';

const email = ref('');
const password = ref('');
const displayName = ref('');
const isRegistering = ref(false);
const currentUser = ref(auth.currentUser);
const isLoading = ref(false);
const errorMessage = ref('');

const router = useRouter();

let stopWatchingAuth;

const isSignedIn = computed(() => Boolean(currentUser.value) );
const userEmail = computed(() => currentUser.value?.email ?? '');

const login = async() => {
    errorMessage.value = '';
    isLoading.value = true;

    try {
        let credential

        if (isRegistering.value) {
            credential = await createUserWithEmailAndPassword(auth, email.value, password.value)
            await setDoc(doc(db, 'profiles', credential.user.uid), {
                displayName: displayName.value.trim(),
                email: email.value,
                location: '',
                bio: '',
                createdAt: serverTimestamp(),
            })
        } else {
            credential = await signInWithEmailAndPassword(auth, email.value, password.value)
        }
        password.value = ''
        const tokenResult = await credential.user.getIdTokenResult(true)
        await router.push(tokenResult.claims.admin === true ? '/admin' : '/profile')
    }

    catch (error) {
        errorMessage.value = error.message
    }

    finally {
        isLoading.value = false
    }
}

const toggleMode = () => {
    isRegistering.value = !isRegistering.value
    errorMessage.value = ''
}

const logout = async () => {
    errorMessage.value = '';
    isLoading.value = true;

    try {
        await signOut(auth)
        await router.push('/')
    }
    catch (error) {
        errorMessage.value = error.message
    }
    finally {
        isLoading.value = false
    }
}

onMounted(() => {
    stopWatchingAuth = onAuthStateChanged(auth, async (user) => {
        currentUser.value = user;

        if (user && !isLoading.value) {
            const tokenResult = await user.getIdTokenResult(true)
            await router.push(tokenResult.claims.admin === true ? '/admin' : '/profile')
        }
    })
}); 

onUnmounted(() => {
    if (stopWatchingAuth) {
        stopWatchingAuth();
    }
});


</script>