import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sitegenDisplayPublicUrl, sitegenPublicSiteUrl } from "./publicUrl";

describe("sitegen canonical public URL", () => {
  it("always uses https://www.rolebolt.tech for canonical links", () => {
    assert.equal(sitegenPublicSiteUrl("aarav"), "https://www.rolebolt.tech/aarav");
    assert.equal(sitegenPublicSiteUrl("my company"), "https://www.rolebolt.tech/my%20company");
  });

  it("uses www host for display labels", () => {
    assert.equal(sitegenDisplayPublicUrl("aarav"), "www.rolebolt.tech/aarav");
  });
});
