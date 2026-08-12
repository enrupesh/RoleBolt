/**
 * Firebase Admin SDK — initialised once, used to verify ID tokens
 * from Google / Microsoft sign-ins on the frontend.
 *
 * Credentials are loaded from FIREBASE_SERVICE_ACCOUNT_JSON (recommended in production)
 * or from backend/firebase-service-account.json for local development only.
 * Never commit service account files to version control.
 */

import * as admin from "firebase-admin";
import path from "path";
import fs from "fs";

let _app: admin.app.App | null = null;

function getApp(): admin.app.App {
  if (_app) return _app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const filePath = path.join(__dirname, "..", "firebase-service-account.json");
  let serviceAccount: admin.ServiceAccount;

  if (raw) {
    serviceAccount = JSON.parse(raw);
  } else if (fs.existsSync(filePath)) {
    serviceAccount = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } else {
    throw new Error(
      "[firebaseAdmin] No service account found. " +
      "Set FIREBASE_SERVICE_ACCOUNT_JSON or place firebase-service-account.json next to package.json (local dev only)."
    );
  }

  _app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("[firebaseAdmin] Initialized ✓");
  return _app;
}

/**
 * Verify a Firebase ID token and return the decoded payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  const app = getApp();
  return app.auth().verifyIdToken(idToken);
}
