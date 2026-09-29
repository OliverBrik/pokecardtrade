import { onMounted, ref } from "vue";

import { createUser, listUsers, removeUser, updateUser } from "../services/users";

export function useAdminUsers() {
  const users = ref([]);
  const isLoading = ref(true);
  const isSaving = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const newUserName = ref("");
  const editingUserId = ref("");
  const editUserName = ref("");

  const resetMessages = () => {
    errorMessage.value = "";
    successMessage.value = "";
  };

  const resetEditForm = () => {
    editingUserId.value = "";
    editUserName.value = "";
  };

  // step 1: load the current Firestore data into reactive Vue state
  const loadUsers = async () => {
    isLoading.value = true;
    resetMessages();

    try {
      users.value = await listUsers();
    } catch (error) {
      errorMessage.value = error.message;
    } finally {
      isLoading.value = false;
    }
  };

  // step 2: create a new user from the input field
  const addUser = async () => {
    const trimmedName = newUserName.value.trim();

    if (!trimmedName) {
      errorMessage.value = "Enter a name before creating a user.";
      return;
    }

    isSaving.value = true;
    resetMessages();

    try {
      await createUser({ name: trimmedName });
      newUserName.value = "";
      successMessage.value = "User created.";
      await loadUsers();
    } catch (error) {
      errorMessage.value = error.message;
    } finally {
      isSaving.value = false;
    }
  };

  // step 3a: copy one user's current values into an edit form
  const startEditing = (user) => {
    resetMessages();
    editingUserId.value = user.id;
    editUserName.value = user.name;
  };

  // step 3b: save the edited values back to Firestore
  const saveUser = async () => {
    const trimmedName = editUserName.value.trim();

    if (!editingUserId.value) {
      errorMessage.value = "Choose a user to edit first.";
      return;
    }

    if (!trimmedName) {
      errorMessage.value = "Enter a name before saving changes.";
      return;
    }

    isSaving.value = true;
    resetMessages();

    try {
      await updateUser(editingUserId.value, { name: trimmedName });
      successMessage.value = "User updated.";
      resetEditForm();
      await loadUsers();
    } catch (error) {
      errorMessage.value = error.message;
    } finally {
      isSaving.value = false;
    }
  };

  // step 3c: let the UI leave edit mode without saving
  const cancelEditing = () => {
    resetMessages();
    resetEditForm();
  };

  // step 4: delete one user document, then refresh the list
  const deleteUser = async (userId) => {
    isSaving.value = true;
    resetMessages();

    try {
      await removeUser(userId);

      if (editingUserId.value === userId) {
        resetEditForm();
      }

      successMessage.value = "User deleted.";
      await loadUsers();
    } catch (error) {
      errorMessage.value = error.message;
    } finally {
      isSaving.value = false;
    }
  };

  onMounted(loadUsers);

  return {
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
  };
}
