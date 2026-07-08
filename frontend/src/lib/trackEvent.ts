import { apiUrl } from "@/lib/api";

type TrackEventData = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(
  event: string,
  data?: TrackEventData,
  uid?: string
): void {
  const sessionId = getSessionId();
  fetch(apiUrl("/track"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, uid, sessionId, data: data ?? {} }),
    keepalive: true,
  }).catch(() => {});
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem("plyndrox_sid");
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem("plyndrox_sid", id);
    }
    return id;
  } catch {
    return "";
  }
}
