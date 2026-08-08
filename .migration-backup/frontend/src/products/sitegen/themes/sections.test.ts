import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { creatorNavItems, seekerNavItems } from "./shared";
import {
  aaravSharmaSeeker,
  fullBusiness,
  minimalSeeker,
  smallBusiness,
  soloCreator,
} from "./fixtures";

describe("sitegen theme section visibility", () => {
  it("Aarav Sharma profile exposes full seeker navigation", () => {
    const items = seekerNavItems(aaravSharmaSeeker);
    assert.ok(items.length >= 6);
    assert.ok(items.some((item) => item.id === "experience"));
    assert.ok(items.some((item) => item.id === "skills"));
    assert.ok(items.some((item) => item.id === "contact"));
  });

  it("minimal seeker avoids empty experience/education/project sections", () => {
    const items = seekerNavItems(minimalSeeker);
    assert.equal(items.some((item) => item.id === "experience"), false);
    assert.equal(items.some((item) => item.id === "education"), false);
    assert.equal(items.some((item) => item.id === "projects"), false);
    assert.ok(items.some((item) => item.id === "skills"));
    assert.ok(items.some((item) => item.id === "contact"));
  });

  it("solo creator hides team when no members exist", () => {
    const items = creatorNavItems(soloCreator);
    assert.equal(items.some((item) => item.id === "team"), false);
    assert.ok(items.some((item) => item.id === "services"));
    assert.ok(items.some((item) => item.id === "portfolio"));
  });

  it("small business hides portfolio and team when unavailable", () => {
    const items = creatorNavItems(smallBusiness);
    assert.equal(items.some((item) => item.id === "portfolio"), false);
    assert.equal(items.some((item) => item.id === "team"), false);
    assert.ok(items.some((item) => item.id === "services"));
    assert.ok(items.some((item) => item.id === "contact"));
  });

  it("full business exposes services, portfolio, and team", () => {
    const items = creatorNavItems(fullBusiness);
    assert.ok(items.some((item) => item.id === "services"));
    assert.ok(items.some((item) => item.id === "portfolio"));
    assert.ok(items.some((item) => item.id === "team"));
  });
});
