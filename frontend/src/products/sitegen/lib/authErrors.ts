import { clearSitegenSession } from "./session";

export class SitegenAuthError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "SitegenAuthError";
  }
}

export async function handleSitegenAuthedResponse<T extends { error?: string }>(
  response: Response,
  data: T,
): Promise<T> {
  if (response.status === 401) {
    clearSitegenSession();
    throw new SitegenAuthError();
  }
  return data;
}
