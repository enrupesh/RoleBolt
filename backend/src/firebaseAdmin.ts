/**
 * Firebase Admin SDK — initialised once, used to verify ID tokens
 * from Google / Microsoft sign-ins on the frontend.
 *
 * Service-account file is read from the filesystem (backend/firebase-service-account.json).
 * Falls back to the FIREBASE_SERVICE_ACCOUNT_JSON env-var if the file is absent
 * (useful in containerised / serverless deployments).
 */

import * as admin from "firebase-admin";
import path from "path";
import fs from "fs";

let _app: admin.app.App | null = null;

function getApp(): admin.app.App {
  if (_app) return _app;

  // Prefer the JSON file shipped with the repo; fall back to env-var.
  const filePath = path.join(__dirname, "..", "firebase-service-account.json");
  let serviceAccount: admin.ServiceAccount;

  if (fs.existsSync(filePath)) {
    serviceAccount = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } else {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error(
        "[firebaseAdmin] No service account found. " +
        "Place firebase-service-account.json next to package.json or set FIREBASE_SERVICE_ACCOUNT_JSON."
      );
    }
    serviceAccount = JSON.parse(raw);
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
