export function formatJobDescription(value?: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const decoded = decodeText(raw);
  const parsed = parseJobDescriptionJson(decoded);
  const text = parsed || extractJd(decoded) || decoded;
  return text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .replace(/^\s*["'{]+/, "")
    .replace(/["'}]+\s*$/, "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeText(input: string) {
  let value = input.trim();
  for (let i = 0; i < 3; i += 1) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") {
        value = parsed.trim();
        continue;
      }
      if (parsed && typeof parsed.jd === "string") return parsed.jd;
      break;
    } catch {
      break;
    }
  }
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseJobDescriptionJson(value: string) {
  const candidates = [
    value,
    value.match(/```json\s*([\s\S]*?)```/)?.[1] || "",
    value.match(/```\s*([\s\S]*?)```/)?.[1] || "",
    value.match(/(\{[\s\S]*\})/)?.[1] || "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === "string") return formatJobDescription(parsed);
      if (parsed && typeof parsed.jd === "string") return formatJobDescription(parsed.jd);
    } catch {}
  }
  return "";
}

function extractJd(value: string) {
  const match = value.match(/"jd"\s*:\s*"([\s\S]*?)"\s*,\s*"rubric"/);
  return match ? decodeText(match[1]) : "";
}