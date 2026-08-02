import dotenv from "dotenv";
import { connectMongo } from "../db";
import { User } from "../models/User";
import { Subscription } from "../models/Subscription";

dotenv.config();

async function migrateFreeEntitlements(): Promise<void> {
  await connectMongo();
  const users = await User.find({}, { _id: 1 }).lean();
  const categories = ["seeker", "creator_form", "creator_standard"] as const;
  const operations = users.flatMap((user) =>
    categories.map((category) => ({
      updateOne: {
        filter: { userId: user._id, category },
        update: {
          $setOnInsert: {
            userId: user._id,
            category,
            plan: "free",
            interval: "monthly",
            status: "free",
            provider: "razorpay",
            providerCustomerId: "",
            providerSubscriptionId: "",
            providerPlanId: "",
            providerLatestPaymentId: "",
            cancelAtPeriodEnd: false,
          },
        },
        upsert: true,
      },
    })),
  );

  if (operations.length > 0) {
    await Subscription.bulkWrite(operations, { ordered: false });
  }
  console.log(`[billing] initialized Free entitlements for ${users.length} users.`);
}

migrateFreeEntitlements()
  .catch((error) => {
    console.error("[billing] Free entitlement migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect();
  });