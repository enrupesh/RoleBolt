import dotenv from "dotenv";
import { connectMongo } from "../db";
import { User } from "../models/User";
import { Subscription } from "../models/Subscription";
import { initializeFreeEntitlements } from "./entitlements";

dotenv.config();

export async function migrateAllUsersToFreeEntitlements(): Promise<{ userCount: number }> {
  await connectMongo();
  const users = await User.find({}, { _id: 1 }).lean();
  for (const user of users) {
    await initializeFreeEntitlements(user._id.toString());
  }
  console.log(`[billing] initialized Free entitlements for ${users.length} users.`);
  return { userCount: users.length };
}

async function migrateFreeEntitlementsCli(): Promise<void> {
  await migrateAllUsersToFreeEntitlements();
}

if (require.main === module) {
  migrateFreeEntitlementsCli()
    .catch((error) => {
      console.error("[billing] Free entitlement migration failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      const mongoose = (await import("mongoose")).default;
      await mongoose.disconnect();
    });
}
