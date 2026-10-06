<template>
  <main class="relative isolate min-h-[calc(100vh-73px)] overflow-hidden px-6 py-10 sm:px-8">
    <div class="pointer-events-none absolute -right-32 top-8 -z-10 h-96 w-96 rounded-full bg-lilac/10 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-40 left-0 -z-10 h-96 w-96 rounded-full bg-mint/10 blur-3xl"></div>

    <div class="mx-auto max-w-6xl">
      <header class="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-mint">Pokecard Trade</p>
          <h1 class="text-3xl font-bold tracking-tight text-linen sm:text-4xl">Admin dashboard</h1>
          <p class="mt-2 text-sm text-linen/55">Manage the users in your trading community.</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="inline-flex items-center justify-center rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm font-semibold text-linen transition hover:border-lilac hover:text-lilac focus:outline-none focus:ring-2 focus:ring-lilac/50 disabled:cursor-not-allowed disabled:opacity-50" type="button" @click="loadUsers" :disabled="isLoading || isSaving || isLoggingOut">
            <span v-if="isLoading" class="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-linen/30 border-t-linen"></span>
            {{ isLoading ? 'Refreshing…' : 'Refresh users' }}
          </button>
          <button class="inline-flex items-center justify-center rounded-xl border border-apricot/30 px-4 py-2.5 text-sm font-semibold text-apricot transition hover:bg-apricot/10 focus:outline-none focus:ring-2 focus:ring-apricot/50 disabled:cursor-not-allowed disabled:opacity-50" type="button" @click="logout" :disabled="isLoggingOut">
            {{ isLoggingOut ? 'Signing out…' : 'Sign out' }}
          </button>
        </div>
      </header>

      <div class="mb-6 grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-white/10 bg-panel/80 p-5"><p class="text-sm text-linen/50">Total users</p><p class="mt-2 text-3xl font-bold text-linen">{{ users.length }}</p></div>
        <div class="rounded-2xl border border-white/10 bg-panel/80 p-5"><p class="text-sm text-linen/50">Database</p><p class="mt-2 flex items-center gap-2 text-lg font-bold text-mint"><span class="h-2 w-2 rounded-full bg-mint shadow-[0_0_10px_var(--color-mint)]"></span>Connected</p></div>
        <div class="rounded-2xl border border-white/10 bg-panel/80 p-5"><p class="text-sm text-linen/50">Workspace</p><p class="mt-2 text-lg font-bold text-apricot">Admin only</p></div>
      </div>

      <section class="mb-6 rounded-2xl border border-white/10 bg-panel/80 p-6">
        <div class="mb-5">
          <p class="mb-2 text-sm font-semibold text-apricot">Create login account</p>
          <h2 class="text-xl font-bold text-linen">Add a user with access</h2>
          <p class="mt-2 text-sm text-linen/50">Creates a Firebase Authentication account and matching profile. Passwords are never stored in Firestore.</p>
        </div>
        <form class="grid gap-4 sm:grid-cols-3" @submit.prevent="createAccount">
          <input v-model="accountForm.displayName" class="rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none focus:border-lilac" placeholder="Display name" required type="text" />
          <input v-model="accountForm.email" class="rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none focus:border-lilac" placeholder="Email" required type="email" />
          <input v-model="accountForm.password" class="rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none focus:border-lilac" placeholder="Temporary password" required minlength="6" type="password" />
          <button class="rounded-xl bg-lilac px-4 py-3 font-bold text-ink sm:col-span-3 disabled:opacity-60" :disabled="isCreatingAccount" type="submit">
            {{ isCreatingAccount ? 'Creating account…' : 'Create login account' }}
          </button>
        </form>
        <p v-if="accountMessage" class="mt-4 text-sm" :class="accountError ? 'text-red-200' : 'text-mint'" role="status">{{ accountMessage }}</p>
      </section>

      <div v-if="errorMessage" class="mb-6 rounded-2xl border border-red-300/20 bg-red-400/10 px-5 py-4 text-sm text-red-200" role="alert">{{ errorMessage }}</div>
      <div v-else-if="successMessage" class="mb-6 rounded-2xl border border-mint/20 bg-mint/10 px-5 py-4 text-sm text-mint" role="status">{{ successMessage }}</div>

      <div class="grid gap-6" :class="editingUserId ? 'lg:grid-cols-[0.75fr_1.25fr]' : 'lg:grid-cols-1'">
        <section v-if="editingUserId" class="h-fit rounded-2xl border border-white/10 bg-panel/80 p-6">
          <div class="mb-6"><p class="mb-2 text-sm font-semibold text-apricot">Edit profile</p><h2 class="text-xl font-bold text-linen">Update user details</h2><p class="mt-2 text-sm leading-5 text-linen/50">Changes are saved to the user's profile.</p></div>
          <div class="space-y-4">
            <label class="block text-sm font-medium text-linen/80" for="edit-display-name">Display name</label>
            <input id="edit-display-name" v-model="editForm.displayName" class="w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none transition placeholder:text-linen/30 focus:border-lilac focus:ring-2 focus:ring-lilac/20" type="text" required />
            <label class="block text-sm font-medium text-linen/80" for="edit-location">Location</label>
            <input id="edit-location" v-model="editForm.location" class="w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none transition placeholder:text-linen/30 focus:border-lilac focus:ring-2 focus:ring-lilac/20" type="text" />
            <label class="block text-sm font-medium text-linen/80" for="edit-bio">Bio</label>
            <textarea id="edit-bio" v-model="editForm.bio" class="min-h-28 w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none transition placeholder:text-linen/30 focus:border-lilac focus:ring-2 focus:ring-lilac/20"></textarea>
            <div class="flex gap-3"><button class="flex-1 rounded-xl bg-lilac px-4 py-3 font-bold text-ink transition hover:bg-lilac/90 disabled:opacity-60" type="button" @click="saveUser" :disabled="isSaving">{{ isSaving ? 'Saving…' : 'Save changes' }}</button><button class="rounded-xl border border-white/15 px-4 py-3 font-semibold text-linen transition hover:border-white/30 disabled:opacity-60" type="button" @click="cancelEditing" :disabled="isSaving">Cancel</button></div>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl border border-white/10 bg-panel/80">
          <div class="flex items-center justify-between border-b border-white/10 px-6 py-5"><div><h2 class="text-xl font-bold text-linen">Registered profiles</h2><p class="mt-1 text-sm text-linen/50">Users created through the profile and account flows.</p></div><span class="rounded-full bg-lilac/15 px-3 py-1 text-xs font-bold text-lilac">{{ users.length }}</span></div>
          <div v-if="isLoading" class="flex items-center justify-center px-6 py-16 text-sm text-linen/50"><span class="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-linen/20 border-t-lilac"></span>Loading users…</div>
          <div v-else-if="!users.length" class="px-6 py-16 text-center"><p class="text-lg font-semibold text-linen">No users yet</p><p class="mt-2 text-sm text-linen/50">Create the first user using the form.</p></div>
          <ul v-else class="divide-y divide-white/10">
            <li v-for="user in users" :key="user.id" class="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-white/[0.03]">
              <div class="flex min-w-0 items-center gap-3"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint/15 text-sm font-bold text-mint">{{ user.displayName.charAt(0).toUpperCase() }}</span><div class="min-w-0"><p class="truncate font-medium text-linen">{{ user.displayName }}</p><p class="truncate text-xs text-linen/45">{{ user.email || 'No email saved' }}<span v-if="user.location"> · {{ user.location }}</span></p></div></div>
              <div class="flex shrink-0 gap-2"><button class="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-linen/70 transition hover:border-lilac hover:text-lilac disabled:opacity-50" type="button" @click="startEditing(user)" :disabled="isSaving">Edit</button></div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useRouter } from "vue-router";
import { useAdminUsers } from "../composables/useAdminUsers";
import { app, auth } from "../firebase";

const router = useRouter();
const isLoggingOut = ref(false);
const isCreatingAccount = ref(false);
const accountMessage = ref("");
const accountError = ref(false);
const accountForm = ref({ displayName: "", email: "", password: "" });

const {
  users,
  isLoading,
  isSaving,
  errorMessage,
  successMessage,
  editingUserId,
  editForm,
  loadUsers,
  startEditing,
  saveUser,
  cancelEditing,
} = useAdminUsers();

const createAccount = async () => {
  isCreatingAccount.value = true;
  accountMessage.value = "";
  accountError.value = false;
  try {
    const createUserAccount = httpsCallable(getFunctions(app), "createUserAccount");
    await createUserAccount(accountForm.value);
    accountMessage.value = "Account and profile created.";
    accountForm.value = { displayName: "", email: "", password: "" };
  } catch (error) {
    accountError.value = true;
    accountMessage.value = error.details || error.message || "The account could not be created.";
  } finally {
    isCreatingAccount.value = false;
  }
};

const logout = async () => {
  isLoggingOut.value = true;

  try {
    await signOut(auth);
    await router.push("/login");
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    isLoggingOut.value = false;
  }
};
</script>
