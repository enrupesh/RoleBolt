"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

type FirebaseConfig = {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  storageBucket: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
};

function getFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;
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
    storageBucket: firebaseConfig.storageBucket!,
    messagingSenderId: firebaseConfig.messagingSenderId!,
    appId: firebaseConfig.appId!,
  };

  const app =
    getApps().length > 0 ? getApps()[0]! : initializeApp(safeConfig);

  authInstance = getAuth(app);
  storageInstance = getStorage(app);
}

export function getFirebaseAuth(): Auth {
  initFirebase();
  return authInstance!;
}

export function getFirebaseStorage(): FirebaseStorage {
  initFirebase();
  return storageInstance!;
}
