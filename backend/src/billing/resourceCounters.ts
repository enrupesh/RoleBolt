import { RecruitForm } from "../models/RecruitForm";
import { RecruitFormResponse } from "../models/RecruitFormResponse";
import { RecruitJob } from "../models/RecruitJob";
import { RecruitCandidate } from "../models/RecruitCandidate";
import { RecruitSeekerProfile } from "../models/RecruitSeekerProfile";
import { RecruitSeekerWorkspace } from "../models/RecruitSeekerWorkspace";
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
  | "active_forms"
  | "stored_forms"
  | "stored_responses"
  | "active_jobs"
  | "stored_jobs"
  | "stored_candidates";

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
];

const formCounters: readonly ResourceCounterKey[] = [
  "active_forms",
  "stored_forms",
  "stored_responses",
];

const standardCounters: readonly ResourceCounterKey[] = [
  "active_jobs",
  "stored_jobs",
  "stored_candidates",
];

export function supportedResourceCounters(category: BillingCategory): readonly ResourceCounterKey[] {
  if (category === "seeker") return seekerCounters;
  if (category === "creator_form") return formCounters;
  return standardCounters;
}

export async function countOwnedResources(
  uid: string,
  category: BillingCategory,
  counter: string,
): Promise<number> {
  if (!uid.trim()) throw new Error("An owner ID is required to count billing resources.");
  const allowed = supportedResourceCounters(category);
  assertCategoryCounter(category, counter, allowed);

  if (category === "creator_standard") {
    if (counter === "active_jobs") {
      return RecruitJob.countDocuments({ uid, status: "active" }).exec();
    }
    if (counter === "stored_jobs") {
      return RecruitJob.countDocuments({ uid }).exec();
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
    return RecruitFormResponse.countDocuments({ uid }).exec();
  }

  const profile = await RecruitSeekerProfile.findOne({ uid })
    .select({ savedJobIds: 1, resumeText: 1, resumeFileName: 1, projects: 1, certifications: 1 })
    .lean()
    .exec();

  if (counter === "saved_jobs") return profile?.savedJobIds?.length ?? 0;
  if (counter === "projects") return profile?.projects?.length ?? 0;
  if (counter === "certifications") return profile?.certifications?.length ?? 0;
  if (counter === "active_resume_versions" || counter === "stored_resume_versions") {
    return profile && (profile.resumeText || profile.resumeFileName) ? 1 : 0;
  }
  if (counter === "active_applications") {
    return RecruitSeekerWorkspace.countDocuments({ uid, status: "applied" }).exec();
  }
  if (counter === "application_history") {
    return RecruitSeekerWorkspace.countDocuments({ uid }).exec();
  }
  return RecruitSeekerWorkspace.countDocuments({ uid, status: { $ne: "archived" } }).exec();
}