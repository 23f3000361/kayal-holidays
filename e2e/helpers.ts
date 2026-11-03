import { expect, type Page } from "@playwright/test";

export const PASSWORD = "kayal-demo-2026";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(admin|account)/);
}
