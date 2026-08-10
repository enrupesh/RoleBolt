import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSeekerStructuredFromAi, buildSeekerFallback } from "./fallback";
import { parseSitegenJson } from "./parseJson";
import { buildSeekerStructuringPrompt, truncateResumeForPrompt } from "./prompts";

const baseSeekerWebsite = {
  username: "seekerqa",
  siteType: "seeker" as const,
  seekerProfile: {
    fullName: "Alex Seeker",
    headline: "Software Engineer",
    summary: "Built APIs and dashboards.",
    skills: ["TypeScript"],
    experience: [{ title: "Engineer", company: "Acme", description: "Shipped features" }],
  },
  resumeText: "Alex Seeker\nSoftware Engineer at Acme",
};

describe("sitegen AI parsing and fallback", () => {
  it("parseSitegenJson rejects invalid JSON", () => {
    assert.throws(() => parseSitegenJson("not-json"));
  });

  it("parseSitegenJson accepts JSON wrapped in code fences", () => {
    const parsed = parseSitegenJson('```json\n{"name":"Alex Seeker"}\n```') as { name: string };
    assert.equal(parsed.name, "Alex Seeker");
  });

  it("filters invented experience not present in source text", () => {
    const structured = parseSeekerStructuredFromAi({
      name: "Alex Seeker",
      headline: "Software Engineer",
      about: "Built APIs and dashboards.",
      skills: ["TypeScript", "ZZZNotARealSkillAtAll"],
      experience: [
        { title: "Engineer", company: "Acme", bullets: ["Shipped features"] },
        { title: "CEO", company: "FakeCorp", bullets: ["Did not exist"] },
      ],
      education: [],
      projects: [],
      certifications: [],
      achievements: [],
      contact: {},
    }, baseSeekerWebsite as never);

    assert.equal(structured.skills.includes("ZZZNotARealSkillAtAll"), false);
    assert.equal(structured.experience.some((item) => item.company === "FakeCorp"), false);
    assert.equal(structured.experience.some((item) => item.company === "Acme"), true);
  });

  it("truncates very long resume text before sending to NVIDIA", () => {
    const longResume = "A".repeat(20_000);
    const truncated = truncateResumeForPrompt(longResume, 100);
    assert.equal(truncated.length < longResume.length, true);
    assert.match(truncated, /truncated for processing/i);

    const prompt = buildSeekerStructuringPrompt({
      profileJson: "{}",
      resumeText: longResume,
    });
    assert.equal(prompt.prompt.includes("A".repeat(20_000)), false);
  });

  it("keeps seeker photoUrl from saved profile, not AI output", () => {
    const website = {
      ...baseSeekerWebsite,
      seekerProfile: {
        ...baseSeekerWebsite.seekerProfile,
        photoUrl: "/sitegen-public/uploads/images/abc123",
      },
    };

    const structured = parseSeekerStructuredFromAi({
      name: "Alex Seeker",
      photoUrl: "https://evil.example/photo.jpg",
      skills: ["TypeScript"],
      experience: [{ title: "Engineer", company: "Acme", bullets: ["Shipped features"] }],
      education: [],
      projects: [],
      certifications: [],
      achievements: [],
      contact: {},
    }, website as never);

    assert.equal(structured.photoUrl, "/sitegen-public/uploads/images/abc123");
  });

  it("fallback seeker content includes optional profile photo", () => {
    const content = buildSeekerFallback({
      username: "seekerqa",
      siteType: "seeker",
      seekerProfile: {
        fullName: "Alex Seeker",
        photoUrl: "/sitegen-public/uploads/images/profile.webp",
      },
    } as never);

    assert.equal(content.photoUrl, "/sitegen-public/uploads/images/profile.webp");
  });
});
