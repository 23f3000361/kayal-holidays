import { describe, expect, it } from "vitest";
import { diffContent, resolveLive, upcoming } from "./versions";
import { publishProblems } from "./package-content";
import { seasonCoverage } from "./pricing";
import { SEED_PACKAGES } from "@/data/packages";

const r = (versionNo: number, publishAt: string, visibility: "public" | "hidden" = "public") => ({ id: `v${versionNo}`, versionNo, publishAt: new Date(publishAt), visibility });

describe("resolveLive", () => {
  const releases = [r(1, "2026-10-01T00:00:00Z"), r(2, "2026-10-20T00:00:00Z"), r(3, "2026-12-01T00:00:00Z")];
  it("returns the newest release whose time has come", () => {
    expect(resolveLive(releases, new Date("2026-11-03T00:00:00Z"))?.id).toBe("v2");
  });
  it("switches to a scheduled release at its time without any job", () => {
    expect(resolveLive(releases, new Date("2026-12-01T00:00:00Z"))?.id).toBe("v3");
  });
  it("returns null before the first release", () => {
    expect(resolveLive(releases, new Date("2026-09-01T00:00:00Z"))).toBeNull();
  });
  it("hides a package after an unpublish release", () => {
    expect(resolveLive([...releases, r(4, "2026-11-01T00:00:00Z", "hidden")], new Date("2026-11-03T00:00:00Z"))).toBeNull();
  });
  it("re-publishing an older version after unpublish brings it back", () => {
    expect(resolveLive([r(1, "2026-10-01T00:00:00Z"), r(2, "2026-10-05T00:00:00Z", "hidden"), r(3, "2026-10-06T00:00:00Z")], new Date("2026-11-01T00:00:00Z"))?.id).toBe("v3");
  });
  it("lists upcoming releases", () => {
    expect(upcoming(releases, new Date("2026-11-03T00:00:00Z")).map((x) => x.id)).toEqual(["v3"]);
  });
});

describe("diffContent", () => {
  const base = SEED_PACKAGES[0].content;
  it("reports a price change by season", () => {
    const next = structuredClone(base);
    next.seasons[1].pricePerPerson = 25900;
    expect(diffContent(base, next)).toEqual([{ field: "seasons", label: "Monsoon price (Jun–Sep)", before: "₹24,900", after: "₹25,900" }]);
  });
  it("reports added seasons and edited days", () => {
    const next = structuredClone(base);
    next.seasons.push({ id: "x", name: "Summer", from: "04-01", to: "05-31", pricePerPerson: 26000, hotelCategory: "4 star" });
    next.itinerary[1].description += " Lunch at a tea estate.";
    const labels = diffContent(base, next).map((c) => c.label);
    expect(labels).toEqual(["New season: Summer", "Day 2"]);
  });
});

describe("publishProblems", () => {
  it("passes the published sample with a warning about the April–May gap", () => {
    const p = publishProblems(SEED_PACKAGES[0].content, seasonCoverage);
    expect(p.filter((x) => x.level === "error")).toEqual([]);
    expect(p.map((x) => x.message)).toContain('No price for 1 Apr–31 May. The site will show "price on request" for those dates.');
  });
  it("blocks publishing when itinerary days don't match the length", () => {
    const c = structuredClone(SEED_PACKAGES[0].content);
    c.durationDays = 7;
    expect(publishProblems(c, seasonCoverage).some((x) => x.level === "error" && x.field === "itinerary")).toBe(true);
  });
  it("blocks overlapping seasons", () => {
    const c = structuredClone(SEED_PACKAGES[0].content);
    c.seasons.push({ id: "xmas", name: "Christmas", from: "12-20", to: "01-05", pricePerPerson: 38000, hotelCategory: "4 star" });
    expect(publishProblems(c, seasonCoverage).filter((x) => x.level === "error").length).toBe(2);
  });
});
