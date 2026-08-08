import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "";

export interface SitegenAccessPayload {
  sub: string;
  username: string;
  kind: "sitegen";
}

export function signSitegenAccessToken(payload: Omit<SitegenAccessPayload, "kind">): string {
  if (!JWT_SECRET) throw new Error("SESSION_SECRET is not configured.");
  return jwt.sign({ ...payload, kind: "sitegen" }, JWT_SECRET, { expiresIn: "90d" });
}

export function verifySitegenAccessToken(token: string): SitegenAccessPayload | null {
  if (!JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as SitegenAccessPayload;
    if (payload.kind !== "sitegen" || !payload.sub || !payload.username) return null;
    return payload;
  } catch {
    return null;
  }
}
