// Measures Largest Contentful Paint on a phone profile with Lighthouse's "slow 4G"
// throttling (150 ms RTT, 1.6 Mbps down) and a 4x CPU slowdown.
// Usage: start the production server, then `node scripts/perf.mjs [baseUrl]`.
import { chromium, devices } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const PATHS = ["/", "/packages", "/packages/munnar-thekkady-alleppey-houseboat", "/destinations/kerala"];
const browser = await chromium.launch();

for (const path of PATHS) {
  const runs = [];
  for (let r = 0; r < 3; r++) {
    const ctx = await browser.newContext({ ...devices["Pixel 7"] });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    let bytes = 0;
    cdp.on("Network.loadingFinished", (e) => (bytes += e.encodedDataLength));
    await page.goto(base + path, { waitUntil: "load" });
    const lcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            resolve(entries[entries.length - 1].startTime);
          }).observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => resolve(-1), 3000);
        }),
    );
    runs.push({ lcpMs: Math.round(lcp), kb: Math.round(bytes / 1024) });
    await ctx.close();
  }
  const median = runs.map((r) => r.lcpMs).sort((a, b) => a - b)[1];
  console.log(`${path.padEnd(48)} LCP median ${median} ms  (${runs.map((r) => r.lcpMs).join(", ")})  ${runs[0].kb} KB`);
}
await browser.close();
