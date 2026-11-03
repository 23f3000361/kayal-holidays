import { describe, expect, it } from "vitest";
import redirects from "@/data/legacy-redirects.json";
import { SEED_PACKAGES } from "@/data/packages";
import { REGION_INFO } from "./regions";

const STATIC = new Set(["/", "/packages", "/enquire", "/privacy", ...Object.values(REGION_INFO).map((r) => `/destinations/${r.slug}`)]);
const PACKAGE_PATHS = new Set(SEED_PACKAGES.filter((p) => p.status === "published").map((p) => `/packages/${p.slug}`));

describe("legacy redirects", () => {
  it("has unique sources", () => {
    const from = redirects.map((r) => r.from);
    expect(new Set(from).size).toBe(from.length);
  });
  it("points every old URL at a page that exists", () => {
    for (const r of redirects) expect(STATIC.has(r.to) || PACKAGE_PATHS.has(r.to), `${r.from} -> ${r.to}`).toBe(true);
  });
  it("never chains or loops", () => {
    const sources = new Set(redirects.map((r) => r.from));
    for (const r of redirects) expect(sources.has(r.to), `${r.to} is itself redirected`).toBe(false);
  });
  it("uses clean absolute paths", () => {
    for (const r of redirects) {
      expect(r.from.startsWith("/")).toBe(true);
      expect(r.to).toMatch(/^\/[a-z0-9/-]*$/);
    }
  });
});
