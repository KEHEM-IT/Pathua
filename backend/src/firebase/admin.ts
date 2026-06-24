// Firebase Admin SDK initializer — singleton pattern so it's safe to import
// from multiple modules during a single Vercel serverless invocation.

import * as admin from "firebase-admin";

let initialized = false;

export function initFirebase(): void {
  if (initialized || admin.apps.length > 0) return;

  // Vercel: set FIREBASE_SERVICE_ACCOUNT env var to the JSON string of your
  // service account key (from Firebase Console → Project Settings → Service accounts).
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountEnv) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT environment variable is not set. " +
      "Download a service account key from the Firebase Console and set it as a JSON string."
    );
  }

  const serviceAccount = JSON.parse(serviceAccountEnv) as admin.ServiceAccount;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });

  initialized = true;
}

export function getFirestore(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

export function getMessaging(): admin.messaging.Messaging {
  return admin.messaging();
}

export function getAuth(): admin.auth.Auth {
  return admin.auth();
}

// Convenience: Firestore server timestamp
export const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
export const increment = (n: number) => admin.firestore.FieldValue.increment(n);
