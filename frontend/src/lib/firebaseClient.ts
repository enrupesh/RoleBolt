/**
 * Firebase client SDK — lazy browser-only initialization.
 * Used for Google OAuth sign-in via popup and phone auth via OTP.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

function readFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
}

let firebaseApp: FirebaseApp | undefined;
let firebaseAuthInstance: Auth | undefined;
let googleProviderInstance: GoogleAuthProvider | undefined;

function assertBrowserAuth(): void {
  if (typeof window === "undefined") {
    throw new Error("Firebase Auth is only available in the browser.");
  }
}

export function getFirebaseAuth(): Auth {
  assertBrowserAuth();
  if (!firebaseAuthInstance) {
    const config = readFirebaseConfig();
    firebaseApp = getApps().length ? getApp() : initializeApp(config);
    firebaseAuthInstance = getAuth(firebaseApp);
  }
  return firebaseAuthInstance;
}

export function getGoogleProvider(): GoogleAuthProvider {
  assertBrowserAuth();
  if (!googleProviderInstance) {
    googleProviderInstance = new GoogleAuthProvider();
    googleProviderInstance.setCustomParameters({ prompt: "select_account" });
  }
  return googleProviderInstance;
}
