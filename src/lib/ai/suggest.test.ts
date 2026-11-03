import { describe, expect, it } from "vitest";
import { SEED_PACKAGES } from "@/data/packages";
import { extractRules } from "./extract";
import { suggestPackages } from "./suggest";
import { draftReply } from "./draft";

const TODAY = new Date("2026-11-03T10:00:00Z");
const live = SEED_PACKAGES.filter((p) => p.status === "published").map((p) => ({ id: p.code, code: p.code, slug: p.slug, content: p.content }));

describe("suggestions for the client's sample enquiry", () => {
  const ex = extractRules("Hi, 2 adults and 1 kid, Kerala 5-6 nights in December, budget around 1.2 lakh total, houseboat a must", TODAY);
  const s = suggestPackages(ex.fields, live);

  it("puts the houseboat tour first, priced from the peak season table", () => {
    expect(s[0].code).toBe("PKG-KL-07");
    expect(s[0].fit).toBe("Strong fit");
    expect(s[0].price?.season.name).toBe("Peak");
    expect(s[0].price?.total).toBe(85313);
  });
  it("only suggests packages that include a houseboat in the top three", () => {
    for (const x of s) expect(live.find((l) => l.code === x.code)!.content.themes).toContain("houseboat");
  });
  it("explains each score", () => {
    expect(s[0].parts.map((p) => p.label)).toEqual(["Destination", "Must-haves", "Length", "Budget", "Trip style"]);
    expect(s[0].parts.find((p) => p.label === "Budget")!.detail).toMatch(/Within budget/);
  });
  it("never suggests draft packages", () => {
    expect(s.map((x) => x.code)).not.toContain("PKG-SI-12");
  });

  it("drafts a reply whose prices match the price table exactly", () => {
    const d = draftReply({ name: "Priya Menon", fields: ex.fields, suggestions: s, questions: ex.questions, consultantName: "Anjali", siteUrl: "https://example.test" });
    expect(d.body).toContain("Dear Priya,");
    expect(d.body).toContain("₹32,500 per adult, twin sharing; ₹16,250 per child (5–11)");
    expect(d.body).toContain("₹81,250 + 5% GST ₹4,063 = ₹85,313");
    expect(d.body).toContain("https://example.test/packages/munnar-thekkady-alleppey-houseboat");
    expect(d.body).toContain("- How old is the child?");
    // Every rupee figure in the draft must come from a package price calculation.
    const allowed = new Set(s.flatMap((x) => (x.price ? [x.price.subtotal, x.price.gst, x.price.total, ...x.price.lines.map((l) => l.unit)] : [x.fromPrice!])));
    const figures = [...d.body.matchAll(/₹([\d,]+)(?![\d.,]| lakh)/g)].map((m) => Number(m[1].replace(/,/g, "")));
    for (const f of figures) expect(allowed.has(f)).toBe(true);
  });
});

describe("other enquiries", () => {
  it("ranks the honeymoon package first for a honeymoon", () => {
    const ex = extractRules("Honeymoon in Munnar from 20-26 Dec, 5 star, luxury please", TODAY);
    expect(suggestPackages(ex.fields, live)[0].code).toBe("PKG-KL-11");
  });
  it("prefers beaches for a beach and ayurveda request", () => {
    const ex = extractRules("2 adults, beach and ayurveda, a week in January", TODAY);
    expect(suggestPackages(ex.fields, live)[0].code).toBe("PKG-KL-15");
  });
  it("falls back to 'price on request' when no season covers the date", () => {
    const ex = extractRules("2 adults Munnar Thekkady Alleppey houseboat must, 5 nights, 2027-04-20", TODAY);
    const top = suggestPackages(ex.fields, live).find((x) => x.code === "PKG-KL-07")!;
    expect(top.price).toBeNull();
    expect(top.warnings).toContain("No published price for the requested dates");
  });
  it("offers a custom itinerary when nothing fits", () => {
    const ex = extractRules("Hampi for 3 nights, 2 adults", TODAY);
    const s = suggestPackages(ex.fields, live);
    const d = draftReply({ name: "Sam", fields: ex.fields, suggestions: s.filter((x) => x.score >= 60), questions: [], consultantName: "Anjali", siteUrl: "https://x" });
    expect(d.body).toContain("custom itinerary");
  });
});
