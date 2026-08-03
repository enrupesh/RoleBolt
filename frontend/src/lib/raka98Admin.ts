import { apiUrl, readApiJson } from "./api";

export const RAKA98_ADMIN_PASSWORD = "raka@9800";
export const RAKA98_ADMIN_SESSION_KEY = "raka98_admin_authed";

export type VerificationRequestStatus = "pending" | "verified" | "rejected" | "all";

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
