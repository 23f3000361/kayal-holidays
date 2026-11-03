import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("old links redirect permanently, whatever their case or trailing slash", async ({ request }) => {
  const r = await request.get("/Kerala-Tour-Packages.HTML", { maxRedirects: 0 });
  expect(r.status()).toBe(308);
  expect(r.headers()["location"]).toMatch(/\/destinations\/kerala$/);
  // Next.js strips a trailing slash first (one more 308), then the proxy redirects.
  const followed = await request.get("/kerala-tour-packages.html/");
  expect(followed.url()).toMatch(/\/destinations\/kerala$/);
});

test("an editor checks and imports a list of old URLs", async ({ page, request }) => {
  test.setTimeout(90_000);
  await login(page, "editor@example.com");
  await page.goto("/admin/redirects");
  await page.fill(
    "#csv",
    ["from,to", "/honeymoon-special.html,/packages/kerala-honeymoon-munnar-thekkady-kumarakom", "/gone.html,/packages/no-such-trip", "/packages,/enquire"].join("\n"),
  );
  await page.getByRole("button", { name: "Check list" }).click();
  await expect(page.getByText("1 ready to import")).toBeVisible();
  await expect(page.getByText("2 will be skipped")).toBeVisible();
  await expect(page.getByText("New URL doesn't exist on the site")).toBeVisible();
  await expect(page.getByText(/a redirect would hide it/)).toBeVisible();

  await page.getByRole("button", { name: "Import 1 redirect" }).click();
  await expect(page.getByText("Imported 1 redirect; skipped 2 with problems.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "/honeymoon-special.html", exact: true })).toBeVisible();

  // The proxy refreshes its copy every 30 seconds.
  await expect
    .poll(async () => (await request.get("/honeymoon-special.html", { maxRedirects: 0 })).headers()["location"] ?? "", { timeout: 45_000, intervals: [2_000] })
    .toMatch(/kerala-honeymoon-munnar-thekkady-kumarakom$/);
});
