export const firebaseFields = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
}

export function validateFirebaseEnv(env, projectId) {
  const missing = Object.values(firebaseFields).filter(key => typeof env[key] !== 'string' || !env[key].trim())
  if (missing.length) throw new Error(`Missing Firebase build configuration: ${missing.join(', ')}. Configure your root .env or run npm run config:hosting.`)
  if (Object.values(firebaseFields).some(key => /[\r\n]/.test(env[key]))) {
    throw new Error('Firebase configuration must contain single-line values.')
  }
  if (env.VITE_FIREBASE_PROJECT_ID !== projectId) {
    throw new Error('Firebase build project must match the default project in .firebaserc.')
  }
}

export function hostingEnv(config, projectId) {
  const env = Object.fromEntries(Object.entries(firebaseFields).map(([field, key]) => [key, config[field]]))
  validateFirebaseEnv(env, projectId)
  return Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n'
}
