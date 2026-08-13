import { test, expect } from "@playwright/test";

test.describe("Sitegen public UX", () => {
  test("landing page loads with product messaging", async ({ page }) => {
    await page.goto("/website");
    await expect(page.getByRole("heading", { name: /create your professional website/i })).toBeVisible();
    await expect(page.getByText(/no account signup required/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /job seeker/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /creator/i }).first()).toBeVisible();
  });

  test("seeker start page loads", async ({ page }) => {
    await page.goto("/website/start/seeker");
    await expect(page.getByText(/username/i).first()).toBeVisible();
    await expect(page.getByText(/password/i).first()).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/website/login");
    await expect(page.getByRole("heading", { name: /sign in to sitegen/i })).toBeVisible();
  });

  test("reserved public username returns not found", async ({ page }) => {
    const response = await page.goto("/website");
    expect(response?.status()).toBeLessThan(400);

    const reserved = await page.goto("/admin");
    expect(reserved?.status()).toBe(404);
  });

  test("unpublished username returns not found", async ({ page }) => {
    const response = await page.goto("/sitegen_unpublished_e2e_user");
    expect(response?.status()).toBe(404);
  });
});

test.describe("Sitegen API happy path", () => {
  test.skip(!process.env.SITEGEN_E2E_API, "Set SITEGEN_E2E_API=1 with backend running");

  test("seeker create → structure → publish → public", async ({ request }) => {
    const suffix = Date.now().toString(36);
    const username = `e2e_seeker_${suffix}`;
    const api = "/sitegen-public";

    const create = await request.post(`${api}/drafts`, {
      data: { username, password: "testpassword123", siteType: "seeker" },
    });
    expect(create.ok()).toBeTruthy();
    const createBody = await create.json();
    const token = createBody.accessToken as string;

    const save = await request.patch(`${api}/drafts/me`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        complete: true,
        seekerProfile: {
          fullName: "E2E Seeker",
          headline: "Engineer",
          summary: "End to end QA profile.",
          skills: ["TypeScript"],
          experience: [{ title: "Dev", company: "Acme", description: "Built APIs" }],
        },
      },
    });
    expect(save.ok()).toBeTruthy();

    const structure = await request.post(`${api}/drafts/me/structure`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(structure.ok()).toBeTruthy();

    const publish = await request.post(`${api}/drafts/me/publish`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(publish.ok()).toBeTruthy();

    const publicSite = await request.get(`${api}/sites/${username}`);
    expect(publicSite.ok()).toBeTruthy();
    const site = await publicSite.json();
    expect(site.site.username).toBe(username);
  });
});
