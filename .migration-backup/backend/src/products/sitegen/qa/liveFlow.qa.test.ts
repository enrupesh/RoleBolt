/**
 * Optional full-stack Sitegen flow against a running API + MongoDB.
 * Run with:
 *   SITEGEN_LIVE_QA=1 MONGODB_URI=... SESSION_SECRET=... BACKEND_URL=http://localhost:8080 \
 *   node --import tsx --test src/products/sitegen/qa/liveFlow.qa.test.ts
 */
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";

const live = process.env.SITEGEN_LIVE_QA === "1" && Boolean(process.env.MONGODB_URI) && Boolean(process.env.SESSION_SECRET);
const apiBase = `${(process.env.BACKEND_URL || "http://localhost:8080").replace(/\/$/, "")}/sitegen-public`;

async function api(path: string, init?: RequestInit & { token?: string }) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (init?.token) headers.set("Authorization", `Bearer ${init.token}`);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

describe("sitegen live flow QA", { skip: !live }, () => {
  let seekerToken = "";
  let seekerUsername = "";
  let creatorToken = "";
  let creatorUsername = "";

  before(() => {
    const suffix = Date.now().toString(36);
    seekerUsername = `qa_seeker_${suffix}`;
    creatorUsername = `qa_creator_${suffix}`;
  });

  it("seeker happy path: create → structure → publish → public", async () => {
    const create = await api("/drafts", {
      method: "POST",
      body: JSON.stringify({
        username: seekerUsername,
        password: "testpassword123",
        siteType: "seeker",
      }),
    });
    assert.equal(create.response.status, 201);
    seekerToken = create.body.accessToken;
    assert.ok(seekerToken);

    await api("/drafts/me", {
      method: "PATCH",
      token: seekerToken,
      body: JSON.stringify({
        complete: true,
        seekerProfile: {
          fullName: "QA Seeker",
          headline: "Engineer",
          summary: "QA summary for live flow.",
          skills: ["TypeScript"],
          experience: [{ title: "Dev", company: "Acme", description: "Built APIs" }],
        },
      }),
    });

    const structure = await api("/drafts/me/structure", { method: "POST", token: seekerToken });
    assert.equal(structure.response.status, 200);
    assert.ok(structure.body.website?.structuredContent);

    const publish = await api("/drafts/me/publish", { method: "POST", token: seekerToken });
    assert.equal(publish.response.status, 200);
    assert.equal(publish.body.website?.status, "published");

    const pub = await api(`/sites/${seekerUsername}`);
    assert.equal(pub.response.status, 200);
    assert.equal(pub.body.site?.username, seekerUsername);

    const draftHidden = await api(`/sites/${seekerUsername}_draft_should_not_exist`);
    assert.equal(draftHidden.response.status, 404);
  });

  it("creator happy path: create → publish public", async () => {
    const create = await api("/drafts", {
      method: "POST",
      body: JSON.stringify({
        username: creatorUsername,
        password: "testpassword123",
        siteType: "creator",
      }),
    });
    assert.equal(create.response.status, 201);
    creatorToken = create.body.accessToken;

    await api("/drafts/me", {
      method: "PATCH",
      token: creatorToken,
      body: JSON.stringify({
        complete: true,
        creatorProfile: {
          businessName: "QA Studio",
          tagline: "Design and build",
          about: "We help small teams ship.",
          services: ["Web design"],
        },
      }),
    });

    await api("/drafts/me/structure", { method: "POST", token: creatorToken });
    const publish = await api("/drafts/me/publish", { method: "POST", token: creatorToken });
    assert.equal(publish.response.status, 200);

    const pub = await api(`/sites/${creatorUsername}`);
    assert.equal(pub.response.status, 200);
  });

  it("blocks cross-user draft access", async () => {
    const other = await api("/drafts/me", { token: "invalid.token.value" });
    assert.equal(other.response.status, 401);
  });

  it("draft site is not publicly accessible before publish", async () => {
    const suffix = Date.now().toString(36);
    const username = `qa_draft_${suffix}`;
    const create = await api("/drafts", {
      method: "POST",
      body: JSON.stringify({ username, password: "testpassword123", siteType: "seeker" }),
    });
    assert.equal(create.response.status, 201);
    const hidden = await api(`/sites/${username}`);
    assert.equal(hidden.response.status, 404);
  });
});
