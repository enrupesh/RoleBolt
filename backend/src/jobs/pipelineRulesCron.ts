import cron from "node-cron";
import { connectMongo } from "../db";
import { RecruitJob } from "../models/RecruitJob";
import { RecruitCandidate } from "../models/RecruitCandidate";
import { evaluatePipelineRules } from "../recruit";
import { canRunMeteredBackgroundWork } from "../billing/backgroundEnforcement";
import { standardBillingOwnerUid } from "../billing/standardEnforcement";

/** Daily sweep for stage_age_days pipeline rules on active jobs. */
export async function runPipelineRulesAgeSweep() {
  await connectMongo();

  const activeJobs = await RecruitJob.find({ status: "active" }).select("_id uid pipelineRules").lean();
  const jobsWithAgeRules = activeJobs.filter(job =>
    ((job as any).pipelineRules ?? []).some(
      (rule: any) => rule.enabled !== false && rule.condition === "stage_age_days",
    ),
  );

  if (!jobsWithAgeRules.length) return;

  let evaluated = 0;
  let skippedJobs = 0;
  for (const job of jobsWithAgeRules) {
    // Phase 4: entitlement is checked at execution time (cron run), not when the
    // rules were configured. If the job owner has since downgraded / cancelled /
    // gone past_due (meteredAccessAllowed=false) or entitlement can't be resolved
    // (fail closed), skip the whole job — do not start metered AI pipeline work.
    const ownerUid = standardBillingOwnerUid(job as any);
    const gate = await canRunMeteredBackgroundWork(ownerUid, "creator_standard");
    if (!gate.allowed) {
      skippedJobs++;
      console.log(
        `[pipeline-cron] Skipping job ${String(job._id)} (owner ${ownerUid || "unknown"}) — billing blocked: ${gate.reason}`,
      );
      continue;
    }

    const candidates = await RecruitCandidate.find({
      jobId: job._id,
      stage: { $nin: ["hired", "rejected"] },
    }).select("_id").lean();

    for (const candidate of candidates) {
      // evaluatePipelineRules meters each individual rule firing; the gate above is
      // the owner-level skip so we never start evaluating candidates for a blocked owner.
      await evaluatePipelineRules(String(job._id), String(candidate._id));
      evaluated++;
    }
  }

  console.log(
    `[pipeline-cron] Evaluated ${evaluated} candidate(s) across ${jobsWithAgeRules.length - skippedJobs} job(s)` +
      (skippedJobs ? `, skipped ${skippedJobs} job(s) for billing.` : "."),
  );
}

export function startPipelineRulesCron() {
  cron.schedule("0 6 * * *", async () => {
    console.log("[pipeline-cron] Running daily stage_age_days sweep...");
    try {
      await runPipelineRulesAgeSweep();
    } catch (err) {
      console.error("[pipeline-cron] Job error:", err);
    }
  });
  console.log("[pipeline-cron] Pipeline rules cron scheduled (daily at 06:00 UTC)");
}
