import { RecruitForm } from "../models/RecruitForm";
import { RecruitFormResponse } from "../models/RecruitFormResponse";
import { RecruitJob } from "../models/RecruitJob";
import { RecruitCandidate } from "../models/RecruitCandidate";
import { RecruitSeekerProfile } from "../models/RecruitSeekerProfile";
import { RecruitSeekerWorkspace } from "../models/RecruitSeekerWorkspace";
import { RecruitSeekerTrackerEntry } from "../models/RecruitSeekerTrackerEntry";
import { RecruitTeamMember } from "../models/RecruitTeamMember";
import { RecruitSeekerResumeVersion } from "../models/RecruitSeekerResumeVersion";
import { RecruitJobAlert } from "../models/RecruitJobAlert";
import type { BillingCategory } from "../billingTypes";

export type ResourceCounterKey =
  | "active_resume_versions"
  | "stored_resume_versions"
  | "saved_jobs"
  | "active_applications"
  | "application_history"
  | "workspace_items"
  | "projects"
  | "certifications"
  | "job_alerts"
  | "active_forms"
  | "stored_forms"
  | "stored_responses"
  | "pipeline_rules"
  | "active_assessments"
  | "active_jobs"
  | "stored_jobs"
  | "stored_candidates"
  | "recruiter_seats";

export class UnsupportedResourceCounterError extends Error {
  readonly code = "UNSUPPORTED_RESOURCE_COUNTER";

  constructor(
    readonly category: BillingCategory,
    readonly counter: string,
  ) {
    super(`No owner-scoped counter implementation exists for ${category}/${counter}.`);
    this.name = "UnsupportedResourceCounterError";
  }
}

function assertCategoryCounter(
  category: BillingCategory,
  counter: string,
  allowed: readonly ResourceCounterKey[],
): asserts counter is ResourceCounterKey {
  if (!allowed.includes(counter as ResourceCounterKey)) {
    throw new UnsupportedResourceCounterError(category, counter);
  }
}

const seekerCounters: readonly ResourceCounterKey[] = [
  "active_resume_versions",
  "stored_resume_versions",
  "saved_jobs",
  "active_applications",
  "application_history",
  "workspace_items",
  "projects",
  "certifications",
  "job_alerts",
];

const formCounters: readonly ResourceCounterKey[] = [
  "active_forms",
  "stored_forms",
  "stored_responses",
  "pipeline_rules",
  "active_assessments",
  "recruiter_seats",
];

const standardCounters: readonly ResourceCounterKey[] = [
  "active_jobs",
  "stored_jobs",
  "stored_candidates",
  "pipeline_rules",
  "active_assessments",
  "recruiter_seats",
];

export function supportedResourceCounters(category: BillingCategory): readonly ResourceCounterKey[] {
  if (category === "seeker") return seekerCounters;
  if (category === "creator_form") return formCounters;
  return standardCounters;
}

async function countRecruiterSeats(ownerUid: string): Promise<number> {
  return RecruitTeamMember.countDocuments({
    ownerUid,
    status: { $in: ["pending", "active"] },
  }).exec();
}

function profileHasResume(profile: {
  resumeText?: string;
  resumeFileName?: string;
} | null): boolean {
  return Boolean(profile && ((profile.resumeText ?? "").trim() || (profile.resumeFileName ?? "").trim()));
}

/**
 * Upsert the active seeker resume version from the current profile fields.
 * Call this when resume text/file is saved so stored/active counters stay accurate.
 */
export async function syncSeekerResumeVersionFromProfile(input: {
  uid: string;
  resumeText?: string;
  resumeFileName?: string;
  source?: "profile_sync" | "upload" | "build" | "import";
}): Promise<void> {
  const uid = input.uid.trim();
  if (!uid) throw new Error("An owner ID is required to sync resume versions.");
  const resumeText = (input.resumeText ?? "").trim();
  const resumeFileName = (input.resumeFileName ?? "").trim();
  if (!resumeText && !resumeFileName) return;

  const existingActive = await RecruitSeekerResumeVersion.findOne({ uid, isActive: true }).exec();
  if (
    existingActive &&
    existingActive.resumeText === resumeText &&
    existingActive.resumeFileName === resumeFileName
  ) {
    return;
  }

  const latest = await RecruitSeekerResumeVersion.findOne({ uid })
    .sort({ versionNumber: -1 })
    .select({ versionNumber: 1 })
    .lean()
    .exec();
  const nextVersion = (latest?.versionNumber ?? 0) + 1;

  await RecruitSeekerResumeVersion.updateMany(
    { uid, isActive: true },
    { $set: { isActive: false } },
  ).exec();

  await RecruitSeekerResumeVersion.create({
    uid,
    versionNumber: nextVersion,
    resumeText,
    resumeFileName,
    isActive: true,
    source: input.source ?? "profile_sync",
  });
}

async function countResumeVersions(
  uid: string,
  mode: "active" | "stored",
): Promise<number> {
  const filter = mode === "active" ? { uid, isActive: true } : { uid };
  const versionCount = await RecruitSeekerResumeVersion.countDocuments(filter).exec();
  if (versionCount > 0) return versionCount;

  // Backward-compatible fallback while historical profiles have no version rows yet.
  const profile = await RecruitSeekerProfile.findOne({ uid })
    .select({ resumeText: 1, resumeFileName: 1 })
    .lean()
    .exec();
  return profileHasResume(profile) ? 1 : 0;
}

/**
 * Owner-scoped resource counters.
 * Verified owner fields:
 * - RecruitJob.uid, RecruitCandidate.uid
 * - RecruitForm.uid, RecruitFormResponse.uid
 * - RecruitTeamMember.ownerUid
 * - RecruitSeeker* documents keyed by uid
 */
export async function countOwnedResources(
  uid: string,
  category: BillingCategory,
  counter: string,
): Promise<number> {
  if (!uid.trim()) throw new Error("An owner ID is required to count billing resources.");
  const allowed = supportedResourceCounters(category);
  assertCategoryCounter(category, counter, allowed);

  if (counter === "recruiter_seats") {
    return countRecruiterSeats(uid);
  }

  if (category === "creator_standard") {
    if (counter === "active_jobs") {
      return RecruitJob.countDocuments({ uid, status: "active" }).exec();
    }
    if (counter === "stored_jobs") {
      return RecruitJob.countDocuments({ uid }).exec();
    }
    if (counter === "pipeline_rules") {
      const jobs = await RecruitJob.find({ uid })
        .select({ pipelineRules: 1 })
        .lean()
        .exec();
      return jobs.reduce((total, job) => {
        const rules = Array.isArray((job as { pipelineRules?: Array<{ enabled?: boolean }> }).pipelineRules)
          ? (job as { pipelineRules: Array<{ enabled?: boolean }> }).pipelineRules
          : [];
        return total + rules.filter((rule) => rule.enabled !== false).length;
      }, 0);
    }
    if (counter === "active_assessments") {
      return RecruitCandidate.countDocuments({
        uid,
        assessmentStatus: { $in: ["sent", "invited", "in_progress"] },
      }).exec();
    }
    return RecruitCandidate.countDocuments({ uid }).exec();
  }

  if (category === "creator_form") {
    if (counter === "active_forms") {
      return RecruitForm.countDocuments({ uid, status: "active" }).exec();
    }
    if (counter === "stored_forms") {
      return RecruitForm.countDocuments({ uid }).exec();
    }
    if (counter === "pipeline_rules") {
      const forms = await RecruitForm.find({ uid })
        .select({ pipelineRules: 1 })
        .lean()
        .exec();
      return forms.reduce((total, form) => {
        const rules = Array.isArray((form as { pipelineRules?: Array<{ enabled?: boolean }> }).pipelineRules)
          ? (form as { pipelineRules: Array<{ enabled?: boolean }> }).pipelineRules
          : [];
        return total + rules.filter((rule) => rule.enabled !== false).length;
      }, 0);
    }
    if (counter === "active_assessments") {
      return RecruitFormResponse.countDocuments({
        uid,
        assessmentStatus: { $in: ["sent", "in_progress"] },
      }).exec();
    }
    return RecruitFormResponse.countDocuments({ uid }).exec();
  }

  if (counter === "active_resume_versions") {
    return countResumeVersions(uid, "active");
  }
  if (counter === "stored_resume_versions") {
    return countResumeVersions(uid, "stored");
  }

  const profile = await RecruitSeekerProfile.findOne({ uid })
    .select({ email: 1, savedJobIds: 1, projects: 1, certifications: 1 })
    .lean()
    .exec();

  if (counter === "job_alerts") {
    const email = (profile?.email ?? "").trim().toLowerCase();
    if (!email) return 0;
    return RecruitJobAlert.countDocuments({ email }).exec();
  }

  if (counter === "saved_jobs") return profile?.savedJobIds?.length ?? 0;
  if (counter === "projects") return profile?.projects?.length ?? 0;
  if (counter === "certifications") return profile?.certifications?.length ?? 0;
  if (counter === "active_applications") {
    const activeCandidateStages = ["applied", "review_zone", "screened", "assessed", "interview", "offer"];
    const [workspaceApplied, trackerActive, roleboltActive] = await Promise.all([
      RecruitSeekerWorkspace.countDocuments({ uid, status: "applied" }).exec(),
      RecruitSeekerTrackerEntry.countDocuments({
        uid,
        stage: { $in: ["applied", "screening", "assessment", "interview", "offer"] },
      }).exec(),
      profile?.email
        ? RecruitCandidate.countDocuments({
            email: profile.email,
            stage: { $in: activeCandidateStages },
          }).exec()
        : Promise.resolve(0),
    ]);
    return workspaceApplied + trackerActive + roleboltActive;
  }
  if (counter === "application_history") {
    return RecruitSeekerWorkspace.countDocuments({ uid }).exec();
  }
  return RecruitSeekerWorkspace.countDocuments({ uid, status: { $ne: "archived" } }).exec();
}
