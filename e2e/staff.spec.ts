import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("consultant works the sample enquiry: extraction, suggestions, reply", async ({ page }) => {
  await login(page, "anjali@example.com");
  await page.goto("/admin/enquiries");
  await page.getByText("Priya Menon").first().click();

  await expect(page.getByLabel("Extracted adults")).toHaveValue("2");
  await expect(page.getByLabel("Extracted children")).toHaveValue("1");
  await expect(page.getByLabel("Budget amount")).toHaveValue("120000");
  await expect(page.locator("mark.evidence", { hasText: "1.2 lakh total" })).toBeVisible();

  const first = page.locator("ol li").filter({ hasText: "PKG-KL-07" }).first();
  await expect(first).toContainText("Strong fit");
  await expect(first).toContainText("₹85,313");
  await expect(page.locator("#body")).toHaveValue(/₹81,250 \+ 5% GST ₹4,063 = ₹85,313/);

  // Correct a field: the traveller later says 2 children.
  await page.getByLabel("Extracted children").fill("2");
  await page.getByRole("button", { name: "Save corrections" }).click();
  await expect(page.getByText("Details confirmed")).toBeVisible();
  await expect(page.locator("#body")).toHaveValue(/2 adults and 2 children/);

  await page.getByRole("button", { name: "Send…" }).click();
  await page.getByRole("button", { name: "Yes, send" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Reply sent/ })).toBeVisible();
  await expect(page.locator("#status")).toHaveValue("replied");
});

test("consultant creates a quote priced from the table and the PDF renders", async ({ page, request }) => {
  await login(page, "anjali@example.com");
  await page.goto("/admin/enquiries?view=all");
  await page.getByText("Priya Menon").first().click();
  await page.fill("#q-date", "2026-12-20");
  await page.fill("#q-ch", "1");
  await expect(page.locator("#quote").locator("..").getByText("₹85,313")).toBeVisible();
  await page.getByRole("button", { name: "Create quote" }).click();
  await expect(page.getByText(/Quote Q-\d{4}-\d{4} created/)).toBeVisible();
  const href = await page.getByRole("link", { name: "PDF" }).first().getAttribute("href");
  const pdf = await request.get(href!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
});

test("access control: editors can't open the inbox; consultants can't open colleagues' enquiries", async ({ page, browser }) => {
  await login(page, "editor@example.com");
  await page.goto("/admin/enquiries");
  await expect(page).toHaveURL(/\/admin\?denied=1/);
  await expect(page.getByRole("link", { name: "Inbox" })).toHaveCount(0);

  // Find an enquiry assigned to Anjali as admin, then try it as Rahul.
  const admin = await browser.newPage();
  await login(admin, "admin@example.com");
  await admin.goto("/admin/enquiries?view=all&q=Katrin");
  await admin.getByText("Katrin Hoffmann").first().click();
  await admin.waitForURL((u) => /[0-9a-f-]{36}$/.test(u.pathname));
  const url = admin.url();
  await admin.close();

  const rahul = await browser.newPage();
  await login(rahul, "rahul@example.com");
  // The admin area streams (loading.tsx), so the status is already 200 when notFound() runs;
  // what matters is that none of the enquiry is shown.
  await rahul.goto(url);
  await expect(rahul.getByText("This page has drifted off")).toBeVisible();
  await expect(rahul.getByText(/Munich/)).toHaveCount(0);
  await rahul.close();
});

test("editor changes a seasonal price, publishes, and the public page updates", async ({ page }) => {
  await login(page, "editor@example.com");
  await page.goto("/admin/packages");
  await page.getByText("Kochi and Alleppey backwater escape").click();
  await page.getByLabel("Monsoon price per person in rupees").fill("17400");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved")).toBeVisible();

  await page.getByRole("button", { name: "Publish…" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("₹16,900")).toBeVisible();
  await expect(dialog.getByText("→ ₹17,400")).toBeVisible();
  await dialog.locator("#note").fill("Monsoon rate update");
  await dialog.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/Published v\d+/)).toBeVisible();

  await page.goto("/packages/kochi-alleppey-backwater-escape");
  await expect(page.getByRole("cell", { name: "₹17,400" })).toBeVisible();

  await page.goto(page.url().replace(/\/packages\/.*/, "/admin/packages"));
  await page.getByText("Kochi and Alleppey backwater escape").click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("link", { name: "Version history" }).click();
  await expect(page.getByText("“Monsoon rate update”")).toBeVisible();
});

test("publishing is blocked while the itinerary doesn't match the length", async ({ page }) => {
  await login(page, "editor@example.com");
  await page.goto("/admin/packages");
  await page.getByText("Wayanad wilderness").click();
  await page.fill("#days", "5");
  await expect(page.getByText("1 thing to fix before publishing")).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByRole("button", { name: "Publish…" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Publish now" })).toBeDisabled();
});
