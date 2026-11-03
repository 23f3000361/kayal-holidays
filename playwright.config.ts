import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build and a freshly seeded database.
// Run `npm run build` first; `npm run test:e2e` resets the demo data.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /public\.spec/ },
  ],
  webServer: {
    command: "npm run db:reset && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
