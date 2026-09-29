<template>
<div>

    <form v-if="!isSignedIn" @submit.prevent="login">
        <label> Email
        <input type="email" v-model="email" />
        </label>

        <label> Password
        <input type="password" v-model="password" />
        </label>

        <button :disabled="isLoading">Sign In</button>
    </form>

    <div v-else>
        <p>Welcome, {{ email }}</p>
        <button @click="logout">Sign Out</button>
        </div>
</div>

</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'vue-router';
import { auth } from '../firebase';

const email = ref('');
const password = ref('');
const currentUser = ref(auth.currentUser);
const isLoading = ref(false);
const errorMessage = ref('');

const router = useRouter();

let stopWatchingAuth;

const isSignedIn = computed(() => Boolean(currentUser.value) );
const userEmail = computed(() => {currentUser.value?.email ?? ""})

const login = async() => {
    errorMessage.value = '';
    isLoading.value = true;

    try {
        await signInWithEmailAndPassword(auth, email.value, password.value)
        password.value = ''
        await router.push('/admin')
    }

    catch (error) {
        errorMessage.value = error.message
    }

    finally {
        isLoading.value = false
    }
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
    stopWatchingAuth = onAuthStateChanged(auth, (user) => {
        currentUser.value = user;
    })
}); 

onUnmounted(() => {
    if (stopWatchingAuth) {
        stopWatchingAuth();
    }
});


</script>