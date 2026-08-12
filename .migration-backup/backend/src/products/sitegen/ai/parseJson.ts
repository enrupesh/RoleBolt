export function parseSitegenJson(raw: string): unknown {
  const trimmed = raw.trim();
  const attempts = [
    trimmed,
    trimmed.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim(),
  ];

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      const match = attempt.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          // continue
        }
      }
    }
  }

  throw new Error("AI returned invalid JSON.");
}
