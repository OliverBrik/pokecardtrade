<template>
  <main>
    <h1>Admin</h1>
    <p>CRUD example for the Firestore users collection.</p>

    <p v-if="isLoading">Loading users...</p>
    <p v-else-if="errorMessage">{{ errorMessage }}</p>
    <p v-else-if="successMessage">{{ successMessage }}</p>

    <button type="button" @click="loadUsers" :disabled="isLoading || isSaving">Reload users</button>

    <section>
      <h2>Step 2: Create user</h2>
      <input v-model="newUserName" type="text" placeholder="Enter a user name" />
      <button type="button" @click="addUser" :disabled="isSaving">Create user</button>
    </section>

    <section>
      <h2>Step 1 and Step 4: Read and delete users</h2>
      <ul v-if="!isLoading">
        <li v-for="user in users" :key="user.id">
          <span>{{ user.name }}</span>
          <button type="button" @click="startEditing(user)" :disabled="isSaving">Edit</button>
          <button type="button" @click="deleteUser(user.id)" :disabled="isSaving">Delete</button>
        </li>
      </ul>
    </section>

    <section v-if="editingUserId">
      <h2>Step 3: Update user</h2>
      <input v-model="editUserName" type="text" placeholder="Edit the user name" />
      <button type="button" @click="saveUser" :disabled="isSaving">Save changes</button>
      <button type="button" @click="cancelEditing" :disabled="isSaving">Cancel</button>
    </section>
  </main>
</template>

<script setup>
import { useAdminUsers } from "../composables/useAdminUsers";

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
</script>
