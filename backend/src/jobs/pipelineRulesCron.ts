import cron from "node-cron";
import { connectMongo } from "../db";
import { RecruitJob } from "../models/RecruitJob";
import { RecruitCandidate } from "../models/RecruitCandidate";
import { evaluatePipelineRules } from "../recruit";

/** Daily sweep for stage_age_days pipeline rules on active jobs. */
export async function runPipelineRulesAgeSweep() {
  await connectMongo();

  const activeJobs = await RecruitJob.find({ status: "active" }).select("_id pipelineRules").lean();
  const jobsWithAgeRules = activeJobs.filter(job =>
    ((job as any).pipelineRules ?? []).some(
      (rule: any) => rule.enabled !== false && rule.condition === "stage_age_days",
    ),
  );

  if (!jobsWithAgeRules.length) return;

  let evaluated = 0;
  for (const job of jobsWithAgeRules) {
    const candidates = await RecruitCandidate.find({
      jobId: job._id,
      stage: { $nin: ["hired", "rejected"] },
    }).select("_id").lean();

    for (const candidate of candidates) {
      await evaluatePipelineRules(String(job._id), String(candidate._id));
      evaluated++;
    }
  }

  console.log(`[pipeline-cron] Evaluated ${evaluated} candidate(s) across ${jobsWithAgeRules.length} job(s).`);
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
