import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any = null;

export function getAuth() {
  if (_auth) return _auth;

  const db = mongoose.connection.db;
  if (!db) throw new Error("[better-auth] MongoDB not connected yet. Call connectMongo() before getAuth().");

  const secret = process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("[better-auth] BETTER_AUTH_SECRET or SESSION_SECRET env var is required.");

  const baseURL =
    process.env.BETTER_AUTH_BASE_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || 8080}`;

  const trustedOrigins = [
    "http://localhost:3000",
    "http://localhost:5000",
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...(process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
      : []),
  ];

  const googleEnabled =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  _auth = betterAuth({
    database: mongodbAdapter(db as any),
    secret,
    baseURL,
    plugins: [bearer()],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    ...(googleEnabled
      ? {
          socialProviders: {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            },
          },
        }
      : {}),
    trustedOrigins,
  });

  console.log(
    `[better-auth] Initialized | baseURL=${baseURL} | Google=${googleEnabled}`
  );
  return _auth;
}
