export const VIDEO_REVIEW_RULES_PATH = "/reviews/video-rules";

export function isValidPublicVideoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getVideoReviewEligibility(input: {
  isRegistered: boolean;
  role?: "creator" | "seeker";
  plan?: "free" | "pro" | "ultra";
}) {
  const { isRegistered, role, plan } = input;
  const canSubmit = isRegistered;
  const rewardEligible = isRegistered && role === "seeker" && (plan === "pro" || plan === "ultra");

  let rewardMessage = "Token rewards are available to Pro and Ultra Pro Job Seekers after Admin approval.";
  if (!isRegistered) {
    rewardMessage = "Sign in to submit a video review.";
  } else if (role === "creator") {
    rewardMessage = "Job Creators can submit video reviews, but token rewards are only available to Pro and Ultra Pro Job Seekers.";
  } else if (plan === "free") {
    rewardMessage = "Free Job Seekers can submit video reviews, but token rewards require a Pro or Ultra Pro plan.";
  } else if (rewardEligible) {
    rewardMessage = "You may qualify for token rewards after Admin reviews your submission.";
  }

  return { canSubmit, rewardEligible, rewardMessage };
}
