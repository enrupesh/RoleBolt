"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

let authInstance: Auth | null = null;
let firebaseUnavailable = false;

function initFirebase() {
  if (authInstance) return;
  if (firebaseUnavailable) return;

  const config = getFirebaseConfig();
  const missing = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);

  if (missing.length) {
    firebaseUnavailable = true;
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[firebase] Missing env vars: ${missing.join(", ")}. Auth disabled in this environment.`);
    }
    return;
  }

  try {
    const app = getApps().length > 0 ? getApps()[0]! : initializeApp({
      apiKey: config.apiKey!,
      authDomain: config.authDomain!,
      projectId: config.projectId!,
      messagingSenderId: config.messagingSenderId!,
      appId: config.appId!,
    });
    authInstance = getAuth(app);
  } catch (err) {
    firebaseUnavailable = true;
    console.warn("[firebase] Init failed:", err);
  }
}

export function getFirebaseAuth(): Auth {
  initFirebase();
  if (!authInstance) {
    throw new Error("Firebase Auth is not configured. Add NEXT_PUBLIC_FIREBASE_* env vars.");
  }
  return authInstance;
}

export function isFirebaseAvailable(): boolean {
  initFirebase();
  return authInstance !== null;
}
