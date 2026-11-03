import { describe, expect, it } from "vitest";
import { SEED_PACKAGES } from "@/data/packages";
import { searchPackages } from "./search";

const items = SEED_PACKAGES.filter((p) => p.status === "published");
const slugs = (r: { slug: string }[]) => r.map((x) => x.slug);

describe("searchPackages", () => {
  it("finds houseboat packages", () => {
    const r = searchPackages(items, { q: "houseboat" });
    expect(r.length).toBe(4);
    expect(r.every((x) => x.content.themes.includes("houseboat"))).toBe(true);
  });
  it("understands local spellings", () => {
    expect(slugs(searchPackages(items, { q: "alappuzha" }))).toContain("munnar-thekkady-alleppey-houseboat");
  });
  it("ranks title matches first", () => {
    expect(searchPackages(items, { q: "wayanad" })[0].slug).toBe("wayanad-wilderness");
  });
  it("filters by region, length and month", () => {
    expect(searchPackages(items, { region: "Karnataka" }).map((x) => x.content.region)).toEqual(["Karnataka"]);
    expect(searchPackages(items, { length: "long" }).every((x) => x.content.durationDays >= 8)).toBe(true);
    // PKG-KL-07 has no April price, so it is not offered for April
    expect(slugs(searchPackages(items, { month: "4" }))).not.toContain("munnar-thekkady-alleppey-houseboat");
  });
  it("returns nothing for nonsense rather than everything", () => {
    expect(searchPackages(items, { q: "zzzqx" })).toEqual([]);
  });
});
