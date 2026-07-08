import mongoose from "mongoose";

let mongoPromise: Promise<typeof mongoose> | null = null;

export async function connectMongo() {
  if (mongoPromise) return mongoPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI in backend environment.");
  }

  mongoPromise = mongoose.connect(uri);
  return mongoPromise;
}

