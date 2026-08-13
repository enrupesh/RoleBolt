/**
 * Firebase client SDK — lazy browser-only initialization.
 * Used for Google OAuth sign-in via popup and phone auth via OTP.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

export class FirebaseClientConfigurationError extends Error {
  readonly code = "FIREBASE_CLIENT_NOT_CONFIGURED";

  constructor(missing: string[]) {
    super(`Firebase is not configured. Missing: ${missing.join(", ")}`);
    this.name = "FirebaseClientConfigurationError";
  }
}

export function firebaseAuthErrorMessage(
  error: unknown,
  fallback = "Sign-in failed. Please try again.",
): string {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  const messages: Record<string, string> = {
    "FIREBASE_CLIENT_NOT_CONFIGURED": "Google sign-in is not configured for this app yet.",
    "auth/unauthorized-domain": "This website is not authorized in Firebase. Add its domain under Firebase Authentication → Settings → Authorized domains.",
    "auth/operation-not-allowed": "Google sign-in is disabled in Firebase Authentication. Enable the Google provider and try again.",
    "auth/invalid-api-key": "The Firebase browser configuration is invalid. Check the Firebase web app settings.",
    "auth/network-request-failed": "Firebase could not reach the network. Check your connection and try again.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in popup. Allow popups for this site and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  };
  return messages[code] ?? (error instanceof Error && error.message ? error.message : fallback);
}

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

function validateFirebaseConfig(config: ReturnType<typeof readFirebaseConfig>) {
  const missing = Object.entries(config)
    .filter(([, value]) => !value.trim())
    .map(([key]) => key);
  if (missing.length) throw new FirebaseClientConfigurationError(missing);
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
    validateFirebaseConfig(config);
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
