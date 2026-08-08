import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSeekerStructuredFromAi } from "./fallback";
import { parseSitegenJson } from "./parseJson";

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
});
