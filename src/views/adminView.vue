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

      <div v-if="errorMessage" class="mb-6 rounded-2xl border border-red-300/20 bg-red-400/10 px-5 py-4 text-sm text-red-200" role="alert">{{ errorMessage }}</div>
      <div v-else-if="successMessage" class="mb-6 rounded-2xl border border-mint/20 bg-mint/10 px-5 py-4 text-sm text-mint" role="status">{{ successMessage }}</div>

      <div class="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <section class="h-fit rounded-2xl border border-white/10 bg-panel/80 p-6">
          <div class="mb-6"><p class="mb-2 text-sm font-semibold text-apricot">{{ editingUserId ? 'Edit user' : 'Add a user' }}</p><h2 class="text-xl font-bold text-linen">{{ editingUserId ? 'Update details' : 'Create user' }}</h2><p class="mt-2 text-sm leading-5 text-linen/50">{{ editingUserId ? 'Change the selected user name.' : 'Add a name to your user collection.' }}</p></div>
          <div v-if="!editingUserId" class="space-y-4">
            <label class="block text-sm font-medium text-linen/80" for="new-user-name">User name</label>
            <input id="new-user-name" v-model="newUserName" class="w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none transition placeholder:text-linen/30 focus:border-lilac focus:ring-2 focus:ring-lilac/20" type="text" placeholder="Enter a user name" @keyup.enter="addUser" />
            <button class="w-full rounded-xl bg-apricot px-4 py-3 font-bold text-ink transition hover:bg-apricot/90 focus:outline-none focus:ring-2 focus:ring-apricot focus:ring-offset-2 focus:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-60" type="button" @click="addUser" :disabled="isSaving">{{ isSaving ? 'Creating…' : 'Create user' }}</button>
          </div>
          <div v-else class="space-y-4">
            <label class="block text-sm font-medium text-linen/80" for="edit-user-name">User name</label>
            <input id="edit-user-name" v-model="editUserName" class="w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-linen outline-none transition placeholder:text-linen/30 focus:border-lilac focus:ring-2 focus:ring-lilac/20" type="text" placeholder="Edit the user name" @keyup.enter="saveUser" />
            <div class="flex gap-3"><button class="flex-1 rounded-xl bg-lilac px-4 py-3 font-bold text-ink transition hover:bg-lilac/90 disabled:opacity-60" type="button" @click="saveUser" :disabled="isSaving">{{ isSaving ? 'Saving…' : 'Save changes' }}</button><button class="rounded-xl border border-white/15 px-4 py-3 font-semibold text-linen transition hover:border-white/30 disabled:opacity-60" type="button" @click="cancelEditing" :disabled="isSaving">Cancel</button></div>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl border border-white/10 bg-panel/80">
          <div class="flex items-center justify-between border-b border-white/10 px-6 py-5"><div><h2 class="text-xl font-bold text-linen">Users</h2><p class="mt-1 text-sm text-linen/50">Manage registered users.</p></div><span class="rounded-full bg-lilac/15 px-3 py-1 text-xs font-bold text-lilac">{{ users.length }}</span></div>
          <div v-if="isLoading" class="flex items-center justify-center px-6 py-16 text-sm text-linen/50"><span class="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-linen/20 border-t-lilac"></span>Loading users…</div>
          <div v-else-if="!users.length" class="px-6 py-16 text-center"><p class="text-lg font-semibold text-linen">No users yet</p><p class="mt-2 text-sm text-linen/50">Create the first user using the form.</p></div>
          <ul v-else class="divide-y divide-white/10">
            <li v-for="user in users" :key="user.id" class="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-white/[0.03]">
              <div class="flex min-w-0 items-center gap-3"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint/15 text-sm font-bold text-mint">{{ user.name.charAt(0).toUpperCase() }}</span><span class="truncate font-medium text-linen">{{ user.name }}</span></div>
              <div class="flex shrink-0 gap-2"><button class="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-linen/70 transition hover:border-lilac hover:text-lilac disabled:opacity-50" type="button" @click="startEditing(user)" :disabled="isSaving">Edit</button><button class="rounded-lg border border-red-300/15 px-3 py-2 text-xs font-semibold text-red-200/70 transition hover:border-red-300/50 hover:text-red-200 disabled:opacity-50" type="button" @click="deleteUser(user.id)" :disabled="isSaving">Delete</button></div>
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
import { useRouter } from "vue-router";
import { useAdminUsers } from "../composables/useAdminUsers";
import { auth } from "../firebase";

const router = useRouter();
const isLoggingOut = ref(false);

// step 1: get reactive state and CRUD actions from one composable
const {
  users,
  isLoading,
  isSaving,
  errorMessage,
  successMessage,
  newUserName,
  editingUserId,
  editUserName,
  loadUsers,
  addUser,
  startEditing,
  saveUser,
  cancelEditing,
  deleteUser,
} = useAdminUsers();

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
