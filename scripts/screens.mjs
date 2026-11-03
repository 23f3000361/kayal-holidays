// Captures the screenshots used in docs/. Start the production server on a freshly
// seeded database first, then run `node scripts/screens.mjs`.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "docs/screens";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const desktop = { viewport: { width: 1440, height: 900 } };
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function session(opts, email) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  if (email) {
    await page.goto(base + "/login");
    await page.fill("#email", email);
    await page.fill("#password", "kayal-demo-2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(admin|account)/);
  }
  return { ctx, page };
}
const shot = async (page, name, full = false) => {
  // Wait for images in view to finish decoding (the optimiser is slow on its first request).
  await page.waitForFunction(() => [...document.images].filter((i) => i.getBoundingClientRect().top < innerHeight && i.loading !== "lazy").every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200); // let entrance animations finish
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
};
const openRow = async (page, text) => {
  await page.getByText(text).first().click();
  await page.waitForURL((u) => /[0-9a-f-]{36}$/.test(u.pathname));
  await page.waitForLoadState("networkidle");
};

{
  const { ctx, page } = await session(desktop);
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await shot(page, "01-home");
  await page.goto(base + "/packages/munnar-thekkady-alleppey-houseboat", { waitUntil: "networkidle" });
  await page.locator("aside input[type=date]").fill("2026-12-20");
  await page.getByRole("button", { name: "More children 5–11" }).click();
  await page.mouse.wheel(0, 560);
  await shot(page, "02-package");
  await ctx.close();
}
{
  const { ctx, page } = await session(phone);
  await page.goto(base + "/packages/munnar-thekkady-alleppey-houseboat", { waitUntil: "networkidle" });
  await shot(page, "03-package-phone");
  await page.goto(base + "/packages/kochi-alleppey-backwater-escape#enquire", { waitUntil: "networkidle" });
  await shot(page, "04-enquiry-phone");
  await ctx.close();
}
{
  const { ctx, page } = await session(desktop, "admin@example.com");
  await page.goto(base + "/admin", { waitUntil: "networkidle" });
  await shot(page, "05-overview");
  await page.goto(base + "/admin/enquiries", { waitUntil: "networkidle" });
  await shot(page, "06-inbox");
  await openRow(page, "Priya Menon");
  await page.getByLabel("Extracted adults").hover();
  await shot(page, "07-enquiry");
  await page.getByText("Why this score").first().click();
  await page.locator("#body").scrollIntoViewIfNeeded();
  await shot(page, "08-suggestions-reply");
  await page.goto(base + "/admin/enquiries?view=all&q=Hoffmann", { waitUntil: "networkidle" });
  await openRow(page, "Katrin Hoffmann");
  await shot(page, "09-low-confidence");
  await ctx.close();
}
{
  const { ctx, page } = await session(desktop, "editor@example.com");
  await page.goto(base + "/admin/packages", { waitUntil: "networkidle" });
  await shot(page, "10-packages");
  await openRow(page, "Munnar, Thekkady and Alleppey houseboat");
  await page.locator("#prices").scrollIntoViewIfNeeded();
  await shot(page, "11-editor-prices");
  await page.getByLabel("Monsoon price per person in rupees").fill("25900");
  await page.getByRole("button", { name: "Publish…" }).click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "12-publish-dialog");
  await page.goto(page.url().replace(/\?.*$/, "") + "/history", { waitUntil: "networkidle" });
  await shot(page, "13-history");
  await ctx.close();
}
{
  const { ctx, page } = await session(phone, "anjali@example.com");
  await page.goto(base + "/admin/enquiries", { waitUntil: "networkidle" });
  await shot(page, "14-inbox-phone");
  await ctx.close();
}
await browser.close();
console.log("Screens written to", out);
