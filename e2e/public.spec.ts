import { test, expect } from "@playwright/test";

test("home page sells the trips and searches", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Travel slowly");
  await page.getByPlaceholder("Houseboat, Munnar, beaches…").fill("houseboat");
  await page.getByRole("button", { name: "Find trips" }).click();
  await expect(page).toHaveURL(/packages\?q=houseboat/);
  await expect(page.getByText("4 trips match")).toBeVisible();
});

test("package page shows per-person, twin-sharing prices with GST and calculates a party price", async ({ page, isMobile }) => {
  await page.goto("/packages/munnar-thekkady-alleppey-houseboat");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Munnar, Thekkady and Alleppey houseboat");
  await expect(page.getByRole("cell", { name: "₹32,500" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "1 Apr–31 May" })).toBeVisible();
  await expect(page.getByText("per person, twin sharing, plus 5% GST").first()).toBeVisible();
  if (!isMobile) {
    await page.locator("aside input[type=date]").fill("2026-12-20");
    await page.getByRole("button", { name: "More children 5–11" }).click();
    await expect(page.locator("aside").getByText("₹85,313")).toBeVisible();
  }
});

test("drafts are not public, old URLs redirect", async ({ page, request }) => {
  const draft = await request.get("/packages/madurai-rameswaram-kanyakumari");
  expect(draft.status()).toBe(404);
  await page.goto("/kerala-tour-packages.html");
  await expect(page).toHaveURL(/\/destinations\/kerala$/);
});

test("enquiry form validates, then sends and acknowledges", async ({ page }) => {
  await page.goto("/packages/kochi-alleppey-backwater-escape#enquire");
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByText("Please tell us your name")).toBeVisible();
  await expect(page.getByText("Please agree so we can reply to you")).toBeVisible();

  await page.fill("#name", "Test Traveller");
  await page.fill("#email", "test.traveller@example.com");
  await page.fill("#message", "Hi, 2 adults and 1 kid, Kerala 5-6 nights in December, budget around 1.2 lakh total, houseboat a must");
  await page.getByLabel(/I agree that Kayal Holidays/).check();
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByRole("heading", { name: "Thank you. We have it." })).toBeVisible();
  await expect(page.getByText(/ENQ-\d+/)).toBeVisible();
});
