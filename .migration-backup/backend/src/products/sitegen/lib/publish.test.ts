import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPublish,
  markNeedsRestructure,
  validatePublishReady,
} from "./publish";
import type { ISitegenWebsite } from "../models/SitegenWebsite";

function mockWebsite(overrides: Partial<ISitegenWebsite> = {}): ISitegenWebsite {
  return {
    username: "demo",
    siteType: "seeker",
    status: "published",
    infoCompletedAt: new Date(),
    structuredContent: {
      type: "seeker",
      name: "Demo User",
      headline: "Engineer",
      about: "About",
      skills: ["TypeScript"],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      achievements: [],
      contact: { email: null, phone: null, location: null, website: null, linkedin: null, github: null, portfolio: null },
      sections: {
        about: true,
        skills: true,
        experience: false,
        education: false,
        projects: false,
        certifications: false,
        achievements: false,
        contact: false,
      },
    },
    selectedThemeId: "seeker-classic",
    publishedStructuredContent: {
      type: "seeker",
      name: "Live User",
      headline: "Live headline",
      about: "Live about",
      skills: ["Go"],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      achievements: [],
      contact: { email: null, phone: null, location: null, website: null, linkedin: null, github: null, portfolio: null },
      sections: {
        about: true,
        skills: true,
        experience: false,
        education: false,
        projects: false,
        certifications: false,
        achievements: false,
        contact: false,
      },
    },
    publishedThemeId: "seeker-classic",
    publishedAt: new Date("2025-01-01"),
    hasUnpublishedChanges: false,
    needsRestructure: false,
    ...overrides,
  } as ISitegenWebsite;
}

describe("sitegen publish safety", () => {
  it("blocks publish when restructuring is required", () => {
    const website = mockWebsite({ needsRestructure: true });
    assert.equal(
      validatePublishReady(website),
      "Your information has changed. Please re-run AI structuring on the preview page before publishing.",
    );
  });

  it("does not replace live snapshot when publish validation fails", () => {
    const website = mockWebsite({ needsRestructure: true });
    const liveSnapshot = website.publishedStructuredContent;
    assert.throws(() => applyPublish(website));
    assert.deepEqual(website.publishedStructuredContent, liveSnapshot);
    assert.equal(website.hasUnpublishedChanges, false);
  });

  it("marks published websites as needing restructure after profile edits", () => {
    const website = mockWebsite();
    markNeedsRestructure(website);
    assert.equal(website.needsRestructure, true);
    assert.equal(website.hasUnpublishedChanges, true);
  });

  it("updates published snapshot only after successful publish", () => {
    const website = mockWebsite({
      structuredContent: {
        ...(mockWebsite().structuredContent as NonNullable<ISitegenWebsite["structuredContent"]>),
        name: "Updated Draft",
      },
      hasUnpublishedChanges: true,
    });

    applyPublish(website);
    assert.equal(website.status, "published");
    assert.equal((website.publishedStructuredContent as { name: string }).name, "Updated Draft");
    assert.equal(website.hasUnpublishedChanges, false);
    assert.equal(website.needsRestructure, false);
  });
});
