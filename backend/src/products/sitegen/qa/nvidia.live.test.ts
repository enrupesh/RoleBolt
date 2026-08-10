/**
 * Optional live NVIDIA structuring smoke test.
 * Run with: SITEGEN_LIVE_NVIDIA=1 GEMINI_FALLBACK_KEY=... node --import tsx --test src/products/sitegen/qa/nvidia.live.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { structureSitegenWebsite } from "../ai/structuring";

const live = process.env.SITEGEN_LIVE_NVIDIA === "1" && Boolean(process.env.GEMINI_FALLBACK_KEY);

describe("sitegen live NVIDIA structuring", { skip: !live }, () => {
  it("structures a minimal seeker profile with NVIDIA", async () => {
    const result = await structureSitegenWebsite({
      username: "liveqa",
      siteType: "seeker",
      status: "draft",
      infoCompletedAt: new Date(),
      seekerProfile: {
        fullName: "Live QA Seeker",
        headline: "Backend Engineer",
        summary: "Experience building APIs in Node.js.",
        skills: ["TypeScript", "Node.js"],
        experience: [{ title: "Engineer", company: "Acme", description: "Built REST APIs" }],
      },
      resumeText: "Live QA Seeker\nBackend Engineer at Acme",
    } as never);

    assert.ok(result.structuredContent);
    assert.equal(result.structuredContent.type, "seeker");
    assert.equal(result.structuredContent.name, "Live QA Seeker");
    assert.ok(["ai_success", "ai_fallback"].includes(result.aiProcessingStatus));
  });
});
