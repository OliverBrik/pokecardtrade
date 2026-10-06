const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp()

exports.createUserAccount = onCall(async (request) => {
  if (!request.auth?.token?.admin) {
    throw new HttpsError('permission-denied', 'Only administrators can create user accounts.')
  }

  const { displayName, email, password } = request.data || {}
  if (typeof displayName !== 'string' || displayName.trim().length < 2) {
    throw new HttpsError('invalid-argument', 'Display name must contain at least two characters.')
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new HttpsError('invalid-argument', 'A valid email address is required.')
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must contain at least six characters.')
  }

  try {
    const user = await getAuth().createUser({
      email: email.trim(),
      password,
      displayName: displayName.trim(),
    })

    await getFirestore().collection('profiles').doc(user.uid).set({
      displayName: displayName.trim(),
      email: email.trim(),
      location: '',
      bio: '',
      createdAt: FieldValue.serverTimestamp(),
    })

    return { uid: user.uid }
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with this email already exists.')
    }
    if (error.code === 'auth/invalid-password') {
      throw new HttpsError('invalid-argument', 'Password must contain at least six characters.')
    }
    if (error.code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', 'A valid email address is required.')
    }

    console.error('createUserAccount failed', error)
    throw new HttpsError('internal', 'The user account could not be created. Check the deployed Firebase Function logs.')
  }
})
