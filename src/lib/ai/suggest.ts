import type { PackageContent, Theme } from "../package-content";
import { priceParty, lowestPrice, type PriceBreakdown } from "../pricing";
import type { ExtractedFields } from "./extract";

/**
 * Ranks live packages against an enquiry. The score is a transparent sum of parts so the
 * consultant can see *why* a package was suggested; nothing here is a black box.
 */

export type Candidate = { id: string; code: string; slug: string; content: PackageContent };

export type ScorePart = { label: string; points: number; max: number; detail: string };
export type Suggestion = {
  packageId: string;
  code: string;
  slug: string;
  title: string;
  score: number;
  fit: "Strong fit" | "Good fit" | "Partial fit";
  parts: ScorePart[];
  price: PriceBreakdown | null;
  priceDate: string | null;
  fromPrice: number | null;
  warnings: string[];
};

export const DEFAULT_ADULTS = 2;

/** The date used for pricing: exact start, else the 15th of the requested month. */
export function pricingDate(f: ExtractedFields): string | null {
  const d = f.travelDates?.value;
  if (!d) return null;
  if (d.start) return d.start;
  if (d.month) return `${d.month}-15`;
  return null;
}

export function partyOf(f: ExtractedFields) {
  return { adults: f.adults?.value ?? DEFAULT_ADULTS, children: f.children?.value ?? 0 };
}

function destinationPart(f: ExtractedFields, c: PackageContent): ScorePart {
  const max = 35;
  const wanted = f.destinations?.value ?? [];
  if (wanted.length === 0) return { label: "Destination", points: 15, max, detail: "No destination given" };
  const regions = new Set(["Kerala", "Tamil Nadu", "Karnataka", "Puducherry", "South India"]);
  const places = wanted.filter((w) => !regions.has(w));
  const wantedRegions = wanted.filter((w) => regions.has(w));
  const regionHit = wantedRegions.includes(c.region) || wantedRegions.includes("South India");
  if (places.length === 0) {
    return regionHit
      ? { label: "Destination", points: 30, max, detail: `In ${c.region}` }
      : { label: "Destination", points: 0, max, detail: `Asked for ${wantedRegions.join(", ")}; this is ${c.region}` };
  }
  const hits = places.filter((p) => c.destinations.includes(p));
  const points = Math.round(max * (hits.length / places.length)) || (regionHit ? 15 : 0);
  const detail = hits.length ? `Covers ${hits.join(", ")}` + (hits.length < places.length ? ` (not ${places.filter((p) => !hits.includes(p)).join(", ")})` : "") : regionHit ? `Same region (${c.region}), different places` : `Does not cover ${places.join(", ")}`;
  return { label: "Destination", points, max, detail };
}

function themePart(f: ExtractedFields, c: PackageContent, warnings: string[]): { part: ScorePart; mustMissing: Theme[] } {
  const max = 25;
  const must = f.mustHaves?.value ?? [];
  const nice = f.interests?.value ?? [];
  if (must.length) {
    const missing = must.filter((m) => !c.themes.includes(m));
    for (const m of missing) warnings.push(`No ${m} in this package`);
    const got = must.length - missing.length;
    return { part: { label: "Must-haves", points: Math.round((max * got) / must.length), max, detail: missing.length ? `Missing ${missing.join(", ")}` : `Includes ${must.join(", ")}` }, mustMissing: missing };
  }
  if (nice.length) {
    const hits = nice.filter((n) => c.themes.includes(n));
    return { part: { label: "Interests", points: Math.round((max * hits.length) / nice.length), max, detail: hits.length ? `Matches ${hits.join(", ")}` : "No matching interests" }, mustMissing: [] };
  }
  return { part: { label: "Interests", points: 12, max, detail: "None stated" }, mustMissing: [] };
}

function durationPart(f: ExtractedFields, c: PackageContent): ScorePart {
  const max = 20;
  const nights = c.durationDays - 1;
  const want = f.nights?.value;
  if (!want) return { label: "Length", points: 10, max, detail: `${nights} nights; length not stated` };
  const dist = nights < want.min ? want.min - nights : nights > want.max ? nights - want.max : 0;
  const wantLabel = want.min === want.max ? `${want.min}` : `${want.min}–${want.max}`;
  return { label: "Length", points: Math.max(0, max - 6 * dist), max, detail: dist === 0 ? `${nights} nights, as asked` : `${nights} nights vs ${wantLabel} asked` };
}

function budgetPart(f: ExtractedFields, price: PriceBreakdown | null, travellers: number): ScorePart {
  const max = 20;
  const b = f.budget?.value;
  if (!price) return { label: "Budget", points: 5, max, detail: "No price for these dates" };
  if (!b) return { label: "Budget", points: 10, max, detail: "No budget given" };
  const budgetTotal = b.basis === "per_person" ? b.inr * travellers : b.inr;
  const over = (price.total - budgetTotal) / budgetTotal;
  if (over <= 0) return { label: "Budget", points: max, max, detail: `Within budget by ${Math.round(-over * 100)}%` };
  return { label: "Budget", points: Math.max(0, Math.round(max * (1 - over / 0.3))), max, detail: `${Math.round(over * 100)}% over budget` };
}

export function suggestPackages(f: ExtractedFields, candidates: Candidate[], limit = 3): Suggestion[] {
  const date = pricingDate(f);
  const party = partyOf(f);
  const travellers = party.adults + party.children;

  const scored = candidates.map((cand): Suggestion => {
    const c = cand.content;
    const warnings: string[] = [];
    const price = date ? priceParty(c, date, party) : null;
    if (date && !price) warnings.push("No published price for the requested dates");

    const parts: ScorePart[] = [destinationPart(f, c)];
    const { part, mustMissing } = themePart(f, c, warnings);
    parts.push(part, durationPart(f, c), budgetPart(f, price, travellers));

    const type = f.tripType?.value;
    if (type === "family" || type === "honeymoon") {
      const has = c.themes.includes(type);
      parts.push({ label: "Trip style", points: has ? 5 : 0, max: 5, detail: has ? `Suits ${type}` : `Not designed for ${type}` });
    }

    let score = parts.reduce((s, p) => s + p.points, 0);
    const maxTotal = parts.reduce((s, p) => s + p.max, 0);
    score = Math.round((100 * score) / maxTotal);
    if (mustMissing.length) score = Math.round(score * 0.5); // a missing must-have is close to disqualifying
    const fit = score >= 75 ? "Strong fit" : score >= 55 ? "Good fit" : "Partial fit";
    return { packageId: cand.id, code: cand.code, slug: cand.slug, title: c.title, score, fit, parts, price, priceDate: date, fromPrice: lowestPrice(c), warnings };
  });

  return scored.sort((a, b) => b.score - a.score || (a.price?.total ?? Infinity) - (b.price?.total ?? Infinity)).slice(0, limit);
}
