import { onMounted, ref } from "vue";

import { listUsers, updateUser } from "../services/users";

export function useAdminUsers() {
  const users = ref([]);
  const isLoading = ref(true);
  const isSaving = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const editingUserId = ref("");
  const editForm = ref({ displayName: "", location: "", bio: "" });

  const resetMessages = () => {
    errorMessage.value = "";
    successMessage.value = "";
  };

  const resetEditForm = () => {
    editingUserId.value = "";
    editForm.value = { displayName: "", location: "", bio: "" };
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

  const startEditing = (user) => {
    resetMessages();
    editingUserId.value = user.id;
    editForm.value = {
      displayName: user.displayName,
      location: user.location,
      bio: user.bio,
    };
  };

  const saveUser = async () => {
    if (!editingUserId.value) {
      errorMessage.value = "Choose a user to edit first.";
      return;
    }

    if (!editForm.value.displayName.trim()) {
      errorMessage.value = "Enter a display name before saving changes.";
      return;
    }

    isSaving.value = true;
    resetMessages();

    try {
      await updateUser(editingUserId.value, {
        displayName: editForm.value.displayName.trim(),
        location: editForm.value.location.trim(),
        bio: editForm.value.bio.trim(),
      });
      successMessage.value = "Profile updated.";
      resetEditForm();
      await loadUsers();
    } catch (error) {
      errorMessage.value = error.message;
    } finally {
      isSaving.value = false;
    }
  };

  const cancelEditing = () => {
    resetMessages();
    resetEditForm();
  };

  onMounted(loadUsers);

  return {
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
  };
}
