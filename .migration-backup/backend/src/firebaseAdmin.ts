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

export class FirebaseAuthConfigurationError extends Error {
  readonly code = "FIREBASE_AUTH_NOT_CONFIGURED";

  constructor(message: string) {
    super(message);
    this.name = "FirebaseAuthConfigurationError";
  }
}

function parseServiceAccount(raw: string): admin.ServiceAccount {
  const value = raw.trim();
  if (!value) {
    throw new FirebaseAuthConfigurationError(
      "FIREBASE_SERVICE_ACCOUNT_JSON is empty.",
    );
  }

  try {
    const parsed = JSON.parse(value) as admin.ServiceAccount & {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.projectId && parsed.project_id) parsed.projectId = parsed.project_id;
    if (!parsed.clientEmail && parsed.client_email) parsed.clientEmail = parsed.client_email;
    if (!parsed.privateKey && parsed.private_key) parsed.privateKey = parsed.private_key;
    return parsed;
  } catch {
    throw new FirebaseAuthConfigurationError(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.",
    );
  }
}

function getApp(): admin.app.App {
  if (_app) return _app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const filePath = path.join(__dirname, "..", "firebase-service-account.json");
  let serviceAccount: admin.ServiceAccount;

  if (raw) {
    serviceAccount = parseServiceAccount(raw);
  } else if (fs.existsSync(filePath)) {
    serviceAccount = parseServiceAccount(fs.readFileSync(filePath, "utf8"));
  } else {
    throw new FirebaseAuthConfigurationError(
      "No Firebase Admin service account is configured. Set FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    throw new FirebaseAuthConfigurationError(
      "Firebase Admin service account is missing projectId, clientEmail, or privateKey.",
    );
  }

  _app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log(`[firebaseAdmin] Initialized for project ${serviceAccount.projectId}`);
  return _app;
}

export function getFirebaseProjectId(): string | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { project_id?: string; projectId?: string };
      return parsed.projectId ?? parsed.project_id ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Verify a Firebase ID token and return the decoded payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  const app = getApp();
  return app.auth().verifyIdToken(idToken);
}
