// Renders docs/tdd.html to docs/TDD.pdf with headless Chromium.
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(path.resolve("docs/tdd.html")).href, { waitUntil: "load" });
await page.pdf({
  path: "docs/TDD.pdf",
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: '<div style="font:8px Segoe UI,sans-serif;color:#9aa09a;width:100%;text-align:center">Kayal Holidays · Technical Design Document · <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
  margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
});
await browser.close();
console.log("docs/TDD.pdf written");
