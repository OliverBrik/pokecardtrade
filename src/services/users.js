import { collection, doc, getDocs, updateDoc } from "firebase/firestore";

import { db } from "../firebase";

const profilesCollection = collection(db, "profiles");

// Data access layer (DAL) functions that talk to Firebase Firestore.
// A service function is a good place for data-access code.
// Basically a service that "talks"/calls firebase and returns the data to the composable.
// It hides Firebase-specific details from the rest of the app.
// Structuring/organizing it like this makes it good for multiple reasons:
//    1) easier to change the database later if we want to,
//    2) makes the composable code cleaner and easier to read,
//    3) makes it easier to test the composable code without needing a real database connection.
// Also, the service know nothings vue refs, loading state, or error handling.
// It just does the database work and returns the data or throws an error. The composable handles the rest.

export async function listUsers() {
  // step 1: read all users from the collection
  // collection(db, "users") points to the Firestore collection named "users".
  // getDocs(...) reads all documents in that collection once.
  const userSnapshot = await getDocs(profilesCollection);

  // A snapshot is Firestore's read result.
  // We map each document into a plain JavaScript object that the UI can use.
  return userSnapshot.docs.map((doc) => ({
    id: doc.id,
    displayName: doc.data().displayName ?? "",
    email: doc.data().email ?? "",
    location: doc.data().location ?? "",
    bio: doc.data().bio ?? "",
  }));
}

export async function updateUser(userId, user) {
  const userDocument = doc(db, "profiles", userId);

  await updateDoc(userDocument, {
    displayName: user.displayName,
    location: user.location,
    bio: user.bio,
  });
}
