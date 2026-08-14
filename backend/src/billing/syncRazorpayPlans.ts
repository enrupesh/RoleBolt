import dotenv from "dotenv";
import {
  createRazorpayPlan,
  getRazorpayPlanEnvKey,
} from "./razorpay";
import {
  BILLING_CATEGORIES,
  BILLING_INTERVALS,
  BILLING_PLANS,
  type BillingCategory,
  type BillingInterval,
  type BillingPlan,
} from "../billingTypes";

dotenv.config();

async function main(): Promise<void> {
  const output: string[] = [];
  for (const category of BILLING_CATEGORIES) {
    for (const plan of BILLING_PLANS.filter((value) => value !== "free")) {
      for (const interval of BILLING_INTERVALS) {
        const key = getRazorpayPlanEnvKey(
          category as BillingCategory,
          plan as BillingPlan,
          interval as BillingInterval,
        );
        if (process.env[key]?.trim()) {
          output.push(`${key}=<already configured>`);
          continue;
        }
        const created = await createRazorpayPlan({
          category: category as BillingCategory,
          plan: plan as BillingPlan,
          interval: interval as BillingInterval,
        });
        output.push(`${key}=${created.id}`);
      }
    }
  }
  console.log("[billing] Razorpay plan configuration:");
  console.log(output.join("\n"));
  console.log("[billing] Store these IDs as server-side environment values; they are not accepted from the frontend.");
}

main().catch((error) => {
  console.error("[billing] Razorpay plan sync failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});