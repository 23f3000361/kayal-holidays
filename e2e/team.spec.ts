import { test, expect } from "@playwright/test";
import { login, PASSWORD } from "./helpers";

test.describe.configure({ mode: "serial" });

test("admin adds a consultant who can sign in with the one-time password", async ({ page, browser }) => {
  await login(page, "admin@example.com");
  await page.goto("/admin/users");
  await page.fill("#new-name", "Joseph Mathew");
  await page.fill("#new-email", "joseph@example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("One-time password for Joseph Mathew")).toBeVisible();
  const password = (await page.locator("code").first().textContent())!.trim();
  expect(password).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);

  const other = await browser.newPage();
  await other.goto("/login");
  await other.fill("#email", "joseph@example.com");
  await other.fill("#password", password);
  await other.getByRole("button", { name: "Sign in" }).click();
  await expect(other).toHaveURL(/\/admin/);
  await expect(other.getByRole("link", { name: /Inbox/ })).toBeVisible();
  await other.close();
});

test("deactivating a consultant signs them out and frees their enquiries", async ({ page, browser }) => {
  const fatima = await browser.newPage();
  await login(fatima, "fatima@example.com");

  await login(page, "admin@example.com");
  await page.goto("/admin/users");
  page.once("dialog", (d) => d.accept());
  await page.locator("li", { hasText: "fatima@example.com" }).getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Fatima Rasheed was deactivated\. \d+ open enquir/ })).toBeVisible();

  await fatima.goto("/admin");
  await expect(fatima).toHaveURL(/\/login/);
  await fatima.fill("#email", "fatima@example.com");
  await fatima.fill("#password", PASSWORD);
  await fatima.getByRole("button", { name: "Sign in" }).click();
  await expect(fatima.getByText("That email and password don't match.")).toBeVisible();
  await fatima.close();
});

test("an admin can't deactivate themselves, and editors can't manage the team", async ({ page, browser }) => {
  await login(page, "admin@example.com");
  await page.goto("/admin/users");
  await expect(page.locator("li", { hasText: "admin@example.com" }).getByRole("button", { name: "Deactivate" })).toBeDisabled();

  const editor = await browser.newPage();
  await login(editor, "editor@example.com");
  await editor.goto("/admin/users");
  await expect(editor).toHaveURL(/\/admin\?denied=1/);
  await editor.close();
});
