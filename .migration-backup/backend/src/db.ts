import mongoose from "mongoose";

let mongoPromise: Promise<typeof mongoose> | null = null;

export class DatabaseConfigurationError extends Error {
  readonly code = "DATABASE_NOT_CONFIGURED";

  constructor() {
    super("MONGODB_URI is not configured.");
    this.name = "DatabaseConfigurationError";
  }
}

export async function connectMongo() {
  if (mongoPromise) return mongoPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new DatabaseConfigurationError();
  }

  mongoPromise = mongoose.connect(uri);
  return mongoPromise;
}

