import { apiUrl, readApiJson } from "./api";

export const RAKA98_ADMIN_PASSWORD = "raka@9800";
export const RAKA98_ADMIN_SESSION_KEY = "raka98_admin_authed";

export type AdminUserLookup = {
  uid: string;
  email: string;
  username: string;
  name: string;
  entitlements: Array<{
    category: "seeker" | "creator_form" | "creator_standard";
    plan: "free" | "pro" | "ultra";
    interval: "monthly" | "yearly";
    status: string;
    periodEnd: string | null;
    billingWarning: string | null;
  }>;
};

export type VerificationRequestStatus = "pending" | "verified" | "rejected" | "all";
export type AdminAuthSettings = {
  requireEmailVerification: boolean;
};
export type FeedbackCategoryFilter = "all" | "product" | "bug" | "feature" | "recruiter" | "job_seeker" | "billing" | "other";
export type FeedbackStatusFilter = "all" | "unread" | "read";

export type AdminFeedback = {
  id: string;
  category: Exclude<FeedbackCategoryFilter, "all">;
  message: string;
  email: string;
  pageUrl: string;
  readAt: string | null;
  createdAt: string | null;
};

export type AdminReview = {
  id: string;
  rating: number;
  title: string;
  message: string;
  displayName: string;
  role: "creator" | "seeker";
  isGuest: boolean;
  featured: boolean;
  visible: boolean;
  createdAt: string | null;
  email: string;
  videoUrl?: string;
  submitterPlan?: "free" | "pro" | "ultra" | null;
};

export type AdminReviewSettings = {
  allowGuestReviews: boolean;
  showFeaturedReviews: boolean;
  featuredXPostUrls: string[];
  savedFeaturedXPostUrls?: string[];
  featuredVideoReviewUrls: string[];
  savedFeaturedVideoReviewUrls?: string[];
};

export type AdminVerificationRequest = {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  profileType: string;
  profileTypeLabel: string;
  companyName: string;
  tagline: string;
  companyType: string;
  industry: string;
  companySize: string;
  location: string;
  website: string;
  linkedinUrl: string;
  personalLinkedinUrl: string;
  portfolioUrl: string;
  description: string;
  mission: string;
  logoUrl: string;
  photoUrl: string;
  instituteType: string;
  affiliationNumber: string;
  registrationNumber: string;
  niche: string;
  verificationStatus: "none" | "requested" | "verified" | "rejected";
  verificationRequestedAt: string | null;
  verificationNote: string;
  verifiedAt: string | null;
  updatedAt: string | null;
  jobCount: number;
  activeJobCount: number;
  hasPublicPresence: boolean;
  publicProfileUrl: string | null;
  recruiterProfileUrl: string;
};

export async function adminFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("X-Admin-Password", RAKA98_ADMIN_PASSWORD);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });
  const data = await readApiJson(response);
  if (!response.ok) {
    throw new Error(data.error || data.message || "Admin request failed.");
  }
  return data;
}

export async function fetchVerificationRequests(status: VerificationRequestStatus) {
  const data = await adminFetch(`/admin/verification-requests?status=${encodeURIComponent(status)}`);
  return data.requests as AdminVerificationRequest[];
}

export async function fetchAuthSettings() {
  const data = await adminFetch("/admin/auth-settings");
  return data.settings as AdminAuthSettings;
}

export async function updateAuthSettings(update: AdminAuthSettings) {
  const data = await adminFetch("/admin/auth-settings", {
    method: "PATCH",
    body: JSON.stringify(update),
  });
  return data.settings as AdminAuthSettings;
}

export async function verifyCompany(uid: string, note = "") {
  return adminFetch(`/admin/verification-requests/${encodeURIComponent(uid)}/verify`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function rejectCompany(uid: string, note = "") {
  return adminFetch(`/admin/verification-requests/${encodeURIComponent(uid)}/reject`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function unverifyCompany(uid: string, note = "") {
  return adminFetch(`/admin/verification-requests/${encodeURIComponent(uid)}/unverify`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function fetchFeedback(category: FeedbackCategoryFilter, status: FeedbackStatusFilter) {
  const data = await adminFetch(`/admin/feedback?category=${encodeURIComponent(category)}&status=${encodeURIComponent(status)}`);
  return {
    feedback: data.feedback as AdminFeedback[],
    unreadCount: Number(data.unreadCount ?? 0),
  };
}

export async function setFeedbackRead(id: string, read: boolean) {
  return adminFetch(`/admin/feedback/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    body: JSON.stringify({ read }),
  });
}

export async function deleteFeedback(id: string) {
  return adminFetch(`/admin/feedback/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchReviews() {
  const data = await adminFetch("/admin/reviews");
  return {
    reviews: data.reviews as AdminReview[],
    settings: data.settings as AdminReviewSettings,
  };
}

export async function updateReview(id: string, update: { featured?: boolean; visible?: boolean }) {
  return adminFetch(`/admin/reviews/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}

export async function deleteReview(id: string) {
  return adminFetch(`/admin/reviews/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function updateReviewSettings(update: Partial<AdminReviewSettings> & {
  featuredXPostUrls?: string[];
  featuredVideoReviewUrls?: string[];
}) {
  const data = await adminFetch("/admin/reviews/settings", {
    method: "PATCH",
    body: JSON.stringify(update),
  });
  return data.settings as AdminReviewSettings;
}
