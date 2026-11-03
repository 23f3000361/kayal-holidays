import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("readers go from a story to the right package and back", async ({ page }) => {
  await page.goto("/blog");
  await expect(page.getByRole("heading", { level: 1, name: "Journal" })).toBeVisible();
  await page.getByText("Your first houseboat night in Alleppey").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("houseboat night");
  await expect(page.getByRole("heading", { name: "Trips for this story" })).toBeVisible();
  // Inline card placed with [[package:…]] in the text
  await page.locator("article a[href='/packages/munnar-thekkady-alleppey-houseboat']").first().click();
  await expect(page).toHaveURL(/\/packages\/munnar-thekkady-alleppey-houseboat$/);
  await expect(page.getByRole("heading", { name: "Read before you go" })).toBeVisible();
});

test("an editor writes, links and publishes a post", async ({ page }) => {
  await login(page, "editor@example.com");
  await page.goto("/admin/blog");
  await page.getByLabel("New post title").fill("Three days in Munnar's tea country");
  await page.getByRole("button", { name: "New post" }).click();
  await page.waitForURL((u) => /\/admin\/blog\/[0-9a-f-]{36}$/.test(u.pathname));

  await expect(page.getByText("Add a cover photo.")).toBeVisible();
  await page.fill("#excerpt", "Tea estates, misty mornings and the best viewpoints, planned for a long weekend.");
  const para = "Munnar sits high in the Western Ghats, and its tea estates roll on for miles around the town. Mornings are cool and misty, so plan the viewpoints for after breakfast when the cloud lifts. ";
  await page.fill("#body", `## Why go\n\n${para.repeat(4)}\n\n## Getting there\n\nMost travellers drive up from Kochi in about four hours.`);
  await expect(page.locator("h2", { hasText: "Getting there" })).toBeVisible(); // live preview

  await page.getByRole("button", { name: "Choose from library" }).click();
  await page.getByRole("button", { name: /Add .*Munnar/ }).first().click();

  await page.getByRole("button", { name: "Suggest from the text" }).click();
  await page.getByRole("button", { name: "Close library" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(page.getByText("Ready to publish")).toBeVisible();

  await page.getByRole("button", { name: "Publish…" }).click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText("Published. The post is on the site.")).toBeVisible();

  await page.goto("/blog/three-days-in-munnars-tea-country");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Three days in Munnar's tea country");
  await expect(page.getByRole("heading", { name: "Trips for this story" })).toBeVisible();
});

test("consultants can't open the journal admin", async ({ page }) => {
  await login(page, "anjali@example.com");
  await page.goto("/admin/blog");
  await expect(page).toHaveURL(/\/admin\?denied=1/);
});
