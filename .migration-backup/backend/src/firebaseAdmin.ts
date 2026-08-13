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
  const value = raw.trim().replace(/^\uFEFF/, "");
  if (!value) {
    throw new FirebaseAuthConfigurationError(
      "FIREBASE_SERVICE_ACCOUNT_JSON is empty.",
    );
  }

  let parsed: admin.ServiceAccount & {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  try {
    parsed = JSON.parse(value);
  } catch {
    try {
      parsed = JSON.parse(escapeControlCharactersInsideJsonStrings(value));
    } catch {
      throw new FirebaseAuthConfigurationError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
  }

  if (!parsed.projectId && parsed.project_id) parsed.projectId = parsed.project_id;
  if (!parsed.clientEmail && parsed.client_email) parsed.clientEmail = parsed.client_email;
  if (!parsed.privateKey && parsed.private_key) parsed.privateKey = parsed.private_key;
  if (parsed.privateKey) parsed.privateKey = parsed.privateKey.replace(/\\n/g, "\n");
  return parsed;
}

function escapeControlCharactersInsideJsonStrings(value: string): string {
  let result = "";
  let insideString = false;
  let escaped = false;

  for (const character of value) {
    if (insideString) {
      if (escaped) {
        result += character;
        escaped = false;
      } else if (character === "\\") {
        result += character;
        escaped = true;
      } else if (character === '"') {
        result += character;
        insideString = false;
      } else if (character === "\n") {
        result += "\\n";
      } else if (character === "\r") {
        result += "\\r";
      } else if (character === "\t") {
        result += "\\t";
      } else {
        result += character;
      }
    } else {
      result += character;
      if (character === '"') insideString = true;
    }
  }

  return result;
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

  const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (clientProjectId && clientProjectId !== serviceAccount.projectId) {
    throw new FirebaseAuthConfigurationError(
      "Firebase client and server credentials belong to different projects.",
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
      return parseServiceAccount(raw).projectId ?? null;
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
