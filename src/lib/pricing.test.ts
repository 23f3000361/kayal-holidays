import { describe, expect, it } from "vitest";
import { priceParty, seasonCoverage, seasonFor, seasonRangeLabel, formatINR, formatLakh } from "./pricing";
import type { Season } from "./package-content";

// PKG-KL-07 from the client's sample data.
const kl07: Season[] = [
  { id: "peak", name: "Peak", from: "10-01", to: "03-31", pricePerPerson: 32500, hotelCategory: "4 star" },
  { id: "monsoon", name: "Monsoon", from: "06-01", to: "09-30", pricePerPerson: 24900, hotelCategory: "4 star" },
];

describe("seasonFor", () => {
  it("finds a season that wraps past New Year", () => {
    expect(seasonFor(kl07, "2026-12-20")?.name).toBe("Peak");
    expect(seasonFor(kl07, "2027-01-02")?.name).toBe("Peak");
    expect(seasonFor(kl07, "2027-03-31")?.name).toBe("Peak");
  });
  it("finds the monsoon season on its edges", () => {
    expect(seasonFor(kl07, "2027-06-01")?.name).toBe("Monsoon");
    expect(seasonFor(kl07, "2027-09-30")?.name).toBe("Monsoon");
  });
  it("returns null in the uncovered April–May gap", () => {
    expect(seasonFor(kl07, "2027-04-15")).toBeNull();
  });
  it("handles 29 February", () => {
    const allYear: Season[] = [{ id: "a", name: "All year", from: "01-01", to: "12-31", pricePerPerson: 18750, hotelCategory: "3 star" }];
    expect(seasonFor(allYear, "2028-02-29")?.name).toBe("All year");
  });
});

describe("seasonCoverage", () => {
  it("reports the April–May gap in the sample data", () => {
    expect(seasonCoverage(kl07)).toEqual({ gaps: ["1 Apr–31 May"], overlaps: [] });
  });
  it("reports overlaps", () => {
    const s: Season[] = [...kl07, { id: "x", name: "Christmas", from: "12-20", to: "01-05", pricePerPerson: 38000, hotelCategory: "4 star" }];
    expect(seasonCoverage(s).overlaps).toEqual(["1 Jan–5 Jan", "20 Dec–31 Dec"]);
  });
});

describe("seasonRangeLabel", () => {
  it("labels whole-month seasons compactly", () => {
    expect(seasonRangeLabel(kl07[0])).toBe("Oct–Mar");
    expect(seasonRangeLabel(kl07[1])).toBe("Jun–Sep");
    expect(seasonRangeLabel({ ...kl07[0], from: "01-01", to: "12-31" })).toBe("All year");
  });
  it("labels partial ranges with days", () => {
    expect(seasonRangeLabel({ ...kl07[0], from: "12-20", to: "01-05" })).toBe("20 Dec–5 Jan");
  });
});

describe("priceParty", () => {
  const content = { seasons: kl07, childPercent: 50, gstPercent: 5 };
  it("prices the sample enquiry (2 adults + 1 child, December)", () => {
    const p = priceParty(content, "2026-12-20", { adults: 2, children: 1 })!;
    expect(p.season.name).toBe("Peak");
    expect(p.lines).toEqual([
      { label: "Adult, twin sharing", qty: 2, unit: 32500, amount: 65000 },
      { label: "Child 5–11, sharing parents' room", qty: 1, unit: 16250, amount: 16250 },
    ]);
    expect(p.subtotal).toBe(81250);
    expect(p.gst).toBe(4063); // 4062.5 rounds half up
    expect(p.total).toBe(85313);
  });
  it("uses the monsoon price in July", () => {
    expect(priceParty(content, "2027-07-10", { adults: 2, children: 0 })!.total).toBe(52290);
  });
  it("returns null when no season covers the date", () => {
    expect(priceParty(content, "2027-05-01", { adults: 2, children: 0 })).toBeNull();
  });
  it("ignores negative and fractional party sizes", () => {
    expect(priceParty(content, "2027-07-10", { adults: 1.7, children: -2 })!.lines).toHaveLength(1);
  });
});

describe("formatting", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(120000)).toBe("₹1,20,000");
    expect(formatLakh(120000)).toBe("₹1.2 lakh");
  });
});
