import { RecruitCompanyProfile } from "../models/RecruitCompanyProfile";
import { RecruitJob } from "../models/RecruitJob";

export async function syncVerifiedCompanyJobs(
  uid: string,
  verified: boolean,
): Promise<{ jobsUpdated: number }> {
  const result = await RecruitJob.updateMany(
    { uid },
    { $set: { verifiedCompany: verified } },
  );
  return { jobsUpdated: result.modifiedCount };
}

export async function setCompanyVerificationStatus(
  uid: string,
  status: "verified" | "rejected" | "none",
  note = "",
): Promise<{ profile: unknown; jobsUpdated: number }> {
  const update: Record<string, unknown> = {
    verificationStatus: status,
    verificationNote: note.trim(),
  };
  const mongoUpdate: Record<string, unknown> = { $set: update };
  if (status === "verified") {
    (mongoUpdate.$set as Record<string, unknown>).verifiedAt = new Date();
  } else {
    mongoUpdate.$unset = { verifiedAt: "" };
  }

  const profile = await RecruitCompanyProfile.findOneAndUpdate(
    { uid },
    mongoUpdate,
    { returnDocument: "after" },
  ).lean();

  if (!profile) {
    throw new Error("Company profile not found.");
  }

  const { jobsUpdated } = await syncVerifiedCompanyJobs(uid, status === "verified");
  return { profile, jobsUpdated };
}
