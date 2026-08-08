import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sitegenWebsiteDto } from "../lib/dto";
import { sitegenPublicSiteDto } from "../lib/publicSiteDto";
import { SITEGEN_RESERVED_USERNAMES } from "../config/reservedUsernames";
import { sanitizeHttpUrl, detectImageContentType, isSafeImageContentType } from "../lib/sanitize";
import { validatePublishReady } from "../lib/publish";

describe("sitegen security integration", () => {
  it("owner DTO never exposes password hash", () => {
    const dto = sitegenWebsiteDto({
      _id: "abc",
      username: "demo",
      siteType: "seeker",
      status: "draft",
      passwordHash: "should-not-leak",
    } as never);
    assert.equal("passwordHash" in dto, false);
    assert.equal(JSON.stringify(dto).includes("should-not-leak"), false);
  });

  it("public site DTO exposes only published-safe fields", () => {
    const dto = sitegenPublicSiteDto({
      username: "demo",
      siteType: "seeker",
      publishedThemeId: "seeker-classic",
      publishedStructuredContent: {
        type: "seeker",
        name: "Demo",
        headline: null,
        about: null,
        skills: [],
        experience: [],
        education: [],
        projects: [],
        certifications: [],
        achievements: [],
        contact: {
          email: null,
          phone: null,
          location: null,
          website: null,
          linkedin: null,
          github: null,
          portfolio: null,
        },
        sections: {
          about: false,
          skills: false,
          experience: false,
          education: false,
          projects: false,
          certifications: false,
          achievements: false,
          contact: false,
        },
      },
      publishedAt: new Date(),
      passwordHash: "secret",
      structuredContent: { type: "seeker", name: "Draft only" },
      seekerProfile: { fullName: "Draft" },
    } as never);

    const json = JSON.stringify(dto);
    assert.equal("passwordHash" in dto, false);
    assert.equal("seekerProfile" in dto, false);
    assert.equal("needsRestructure" in dto, false);
    assert.equal(json.includes("secret"), false);
    assert.equal(json.includes("Draft only"), false);
    assert.equal((dto.structuredContent as { name?: string })?.name, "Demo");
    assert.equal(dto.publicUrl, "https://www.rolebolt.tech/demo");
  });

  it("reserved username set blocks route collisions", () => {
    for (const reserved of ["admin", "website", "offline", "seeker", "creator", "manage", "login"]) {
      assert.equal(SITEGEN_RESERVED_USERNAMES.has(reserved), true);
    }
  });

  it("blocks javascript/data URL schemes in profile URLs", () => {
    assert.equal(sanitizeHttpUrl("javascript:alert(1)"), undefined);
    assert.equal(sanitizeHttpUrl("data:text/html,<script>alert(1)</script>"), undefined);
    assert.equal(sanitizeHttpUrl("https://example.com"), "https://example.com/");
  });

  it("rejects non-image uploads by magic bytes", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    assert.equal(detectImageContentType(svg), null);
    assert.equal(isSafeImageContentType("image/svg+xml"), false);
  });

  it("blocks publish when restructuring is required", () => {
    const message = validatePublishReady({
      infoCompletedAt: new Date(),
      structuredContent: { type: "seeker", name: "A" },
      selectedThemeId: "seeker-classic",
      siteType: "seeker",
      needsRestructure: true,
    } as never);
    assert.match(String(message), /re-run AI structuring/i);
  });
});
