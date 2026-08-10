import dotenv from "dotenv";
import { connectMongo } from "../db";
import {
  reconcileAllPaidSubscriptions,
  reconcileSubscription,
} from "./subscriptionLifecycle";
import { isBillingCategory, type BillingCategory } from "../billingTypes";

dotenv.config();

function parseArgs(argv: string[]): {
  dryRun: boolean;
  userId?: string;
  category?: BillingCategory;
  help: boolean;
} {
  const out: {
    dryRun: boolean;
    userId?: string;
    category?: BillingCategory;
    help: boolean;
  } = { dryRun: false, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--user" || arg === "--userId") {
      out.userId = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--user=")) out.userId = arg.slice("--user=".length);
    else if (arg === "--category") {
      out.category = argv[i + 1] as BillingCategory;
      i += 1;
    } else if (arg.startsWith("--category=")) {
      out.category = arg.slice("--category=".length) as BillingCategory;
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`Rolebolt Razorpay subscription reconciliation

Usage:
  npm run billing:reconcile -- [--dry-run] [--user <userId>] [--category <category>]

Options:
  --dry-run              Report mismatches without writing repairs
  --user <userId>        Limit to one Mongo user id
  --category <category>  seeker | creator_form | creator_standard
  --help                 Show this help

Environment:
  MONGODB_URI
  RAZORPAY_KEY_ID
  RAZORPAY_KEY_SECRET
  RAZORPAY_PLAN_<CATEGORY>_<PLAN>_<INTERVAL>  (18 paid plan IDs)

This command fetches each local paid Razorpay subscription from the provider,
compares status/plan/cancel flags, and repairs mismatches with a BillingAuditLog
entry. It never trusts checkout redirects or client callbacks.
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.category && !isBillingCategory(args.category)) {
    throw new Error(`Invalid category: ${args.category}`);
  }

  await connectMongo();

  const results =
    args.userId && args.category
      ? [
          await reconcileSubscription({
            userId: args.userId,
            category: args.category,
            dryRun: args.dryRun,
            actor: "cli",
          }),
        ]
      : await reconcileAllPaidSubscriptions({
          dryRun: args.dryRun,
          userId: args.userId,
          category: args.category,
        });

  const repaired = results.filter((r) => r.outcome === "repaired").length;
  const noop = results.filter((r) => r.outcome === "noop").length;
  const failed = results.filter((r) => r.outcome === "failed").length;
  const skipped = results.filter((r) => r.outcome === "skipped").length;

  console.log("[billing] reconciliation results:");
  for (const result of results) {
    console.log(
      `- ${result.userId}/${result.category}: ${result.outcome} — ${result.summary}`,
    );
  }
  console.log(
    `[billing] summary: total=${results.length} repaired=${repaired} noop=${noop} failed=${failed} skipped=${skipped} dryRun=${args.dryRun}`,
  );

  if (failed > 0) process.exitCode = 1;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(
        "[billing] reconciliation failed:",
        error instanceof Error ? error.message : error,
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      const mongoose = (await import("mongoose")).default;
      await mongoose.disconnect().catch(() => undefined);
    });
}
