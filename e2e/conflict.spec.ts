import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

async function openPackage(page: Page, title: string) {
  await page.goto("/admin/packages");
  await page.getByText(title).first().click();
  await page.waitForURL((u) => /\/admin\/packages\/[0-9a-f-]{36}$/.test(u.pathname));
}

test("a second editor can't silently overwrite the first one's save", async ({ browser }) => {
  const thomas = await browser.newPage();
  const meera = await browser.newPage();
  await login(thomas, "editor@example.com");
  await login(meera, "admin@example.com");
  await openPackage(thomas, "Coorg and Mysore");
  await openPackage(meera, "Coorg and Mysore");

  await thomas.fill("#summary", "Coffee-estate mornings in Coorg and the palaces of Mysore, at an easy pace.");
  await thomas.getByRole("button", { name: "Save draft" }).click();
  await expect(thomas.getByText("Draft saved")).toBeVisible();

  await meera.fill("#title", "Coorg and Mysore (edited)");
  await meera.getByRole("button", { name: "Save draft" }).click();
  const banner = meera.getByRole("alert").filter({ hasText: "Not saved." });
  await expect(banner).toContainText("Thomas Varghese saved this draft");
  await expect(meera.locator("#title")).toHaveValue("Coorg and Mysore (edited)"); // her work is still on screen

  await banner.getByRole("button", { name: "Reload the latest draft" }).click();
  await expect(meera.locator("#summary")).toHaveValue(/at an easy pace/);
  // After reloading she can save normally.
  await meera.fill("#title", "Coorg and Mysore");
  await meera.fill("#title", "Coorg and Mysore, slowly");
  await meera.getByRole("button", { name: "Save draft" }).click();
  await expect(meera.getByText("Draft saved")).toBeVisible();

  await thomas.close();
  await meera.close();
});
