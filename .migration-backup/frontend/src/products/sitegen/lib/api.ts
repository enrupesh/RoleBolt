import { API_BASE_URL } from "@/lib/api";
import { SITEGEN_API_PREFIX } from "../config/api";

export function sitegenApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${SITEGEN_API_PREFIX}${normalizedPath}`;
}
