import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCreatorSectionVisibility, applySeekerSectionVisibility } from "./sections";
import type { SitegenCreatorStructuredContent, SitegenSeekerStructuredContent } from "../types/structuredContent";

const seekerBase: SitegenSeekerStructuredContent = {
  type: "seeker",
  name: "Alex Seeker",
  headline: "Engineer",
  about: "Built APIs.",
  photoUrl: null,
  skills: ["TypeScript"],
  experience: [{ title: "Engineer", company: "Acme", startDate: "2020", endDate: null, current: true, bullets: ["Shipped"] }],
  education: [],
  projects: [],
  certifications: [],
  achievements: [],
  contact: { email: "alex@example.com", phone: null, location: null, website: null, linkedin: null, github: null, portfolio: null },
  sections: {
    about: true,
    skills: true,
    experience: true,
    education: true,
    projects: true,
    certifications: true,
    achievements: true,
    contact: true,
  },
};

describe("sitegen section visibility", () => {
  it("hides empty seeker sections", () => {
    const visible = applySeekerSectionVisibility(seekerBase);
    assert.equal(visible.sections.education, false);
    assert.equal(visible.sections.projects, false);
    assert.equal(visible.sections.experience, true);
    assert.equal(visible.sections.contact, true);
  });

  it("hides empty creator sections", () => {
    const creator: SitegenCreatorStructuredContent = {
      type: "creator",
      businessName: "Acme Studio",
      tagline: "Design",
      about: "We design brands.",
      category: "Agency",
      logoUrl: null,
      services: ["Branding"],
      location: null,
      contact: { email: "hi@acme.test", phone: null, website: null },
      socialLinks: { linkedin: null, instagram: null, twitter: null, youtube: null, tiktok: null },
      portfolio: [],
      team: [],
      sections: { hero: true, about: true, services: true, portfolio: true, team: true, contact: true },
    };

    const visible = applyCreatorSectionVisibility(creator);
    assert.equal(visible.sections.portfolio, false);
    assert.equal(visible.sections.team, false);
    assert.equal(visible.sections.services, true);
    assert.equal(visible.sections.contact, true);
  });
});
