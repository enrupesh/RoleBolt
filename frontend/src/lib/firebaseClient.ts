"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Note: Firebase Storage is intentionally not used in this app — image uploads
// (logos, photos) are stored in MongoDB via the backend instead, since this
// project does not have a Firebase Storage bucket subscription.
type FirebaseConfig = {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
};

function getFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

let authInstance: Auth | null = null;
let initError: Error | null = null;

function initFirebase() {
  if (authInstance) return;
  if (initError) throw initError;

  const firebaseConfig = getFirebaseConfig();

  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    initError = new Error(
      `Missing Firebase env vars: ${missing.join(
        ", "
      )}. Add them to frontend/.env.local with NEXT_PUBLIC_ prefixes.`
    );
    throw initError;
  }

  const safeConfig = {
    apiKey: firebaseConfig.apiKey!,
    authDomain: firebaseConfig.authDomain!,
    projectId: firebaseConfig.projectId!,
    messagingSenderId: firebaseConfig.messagingSenderId!,
    appId: firebaseConfig.appId!,
  };

  const app =
    getApps().length > 0 ? getApps()[0]! : initializeApp(safeConfig);

  authInstance = getAuth(app);
}

export function getFirebaseAuth(): Auth {
  initFirebase();
  return authInstance!;
}
