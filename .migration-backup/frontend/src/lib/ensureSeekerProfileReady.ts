import { apiUrl } from "@/lib/api";

type SeekerProfileSeed = {
  username?: string;
  email?: string;
};

/**
 * Prepares seeker-side records without changing a judge's canonical creator role.
 */
export async function ensureSeekerProfileReady(
  token: string,
  profile?: SeekerProfileSeed,
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const existingRes = await fetch(apiUrl("/recruit/auth/profile"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const existingData = existingRes.ok
    ? await existingRes.json().catch(() => ({}))
    : {};

  const patchBody: Record<string, string | undefined> = {
    email: profile?.email,
    username: profile?.username,
  };
  if (existingData.role !== "creator") {
    patchBody.role = "seeker";
  }

  await fetch(apiUrl("/recruit/auth/profile"), {
    method: "PATCH",
    headers,
    body: JSON.stringify(patchBody),
  });

  await fetch(apiUrl("/recruit/seeker/profile"), {
    method: "PUT",
    headers,
    body: JSON.stringify({
      username: profile?.username,
      email: profile?.email,
    }),
  });
}
