import { z } from "zod";

/**
 * A package version is an immutable snapshot of this content.
 * Drafts are validated loosely (so editors can save half-finished work);
 * publishing runs `publishProblems` and blocks on any error.
 */

export const THEMES = [
  "houseboat",
  "backwaters",
  "hills",
  "tea gardens",
  "wildlife",
  "beach",
  "heritage",
  "temples",
  "ayurveda",
  "food",
  "culture",
  "waterfalls",
  "adventure",
  "family",
  "honeymoon",
  "pilgrimage",
] as const;

export const REGIONS = ["Kerala", "Tamil Nadu", "Karnataka", "Puducherry"] as const;
export const HOTEL_CATEGORIES = ["3 star", "4 star", "5 star", "Heritage", "Houseboat"] as const;

const monthDay = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Use MM-DD");

export const seasonSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Name the season").max(60),
  from: monthDay, // inclusive, recurring every year
  to: monthDay, // inclusive; may wrap past New Year (e.g. 10-01 → 03-31)
  pricePerPerson: z.number().int("Whole rupees only").min(1000, "Price looks too low").max(2_000_000),
  hotelCategory: z.string().trim().min(1).max(40),
});

export const itineraryDaySchema = z.object({
  day: z.number().int().min(1),
  title: z.string().trim().min(1, "Give the day a title").max(120),
  description: z.string().trim().max(2000),
  overnight: z.string().trim().max(80).default(""),
  meals: z.string().trim().max(80).default(""),
});

export const photoSchema = z.object({
  src: z.string().min(1).refine((s) => s.startsWith("/photos/") || s.startsWith("/media/"), "Pick a photo from the library"),
  alt: z.string().trim().max(160).default(""),
});

export const mapStopSchema = z.object({
  name: z.string().trim().min(1).max(60),
  lat: z.number().min(5).max(20),
  lng: z.number().min(70).max(85),
});

export const hotelSchema = z.object({
  location: z.string().trim().min(1).max(60),
  name: z.string().trim().max(100).default(""),
  category: z.string().trim().max(40),
  nights: z.number().int().min(1).max(30),
});

export const packageContentSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(120),
  summary: z.string().trim().max(400).default(""),
  region: z.enum(REGIONS),
  destinations: z.array(z.string().trim().min(1)).max(12),
  durationDays: z.number().int().min(1).max(30),
  themes: z.array(z.enum(THEMES)).max(10),
  highlights: z.array(z.string().trim().min(1).max(160)).max(8),
  itinerary: z.array(itineraryDaySchema).max(30),
  inclusions: z.array(z.string().trim().min(1).max(200)).max(25),
  exclusions: z.array(z.string().trim().min(1).max(200)).max(25),
  hotels: z.array(hotelSchema).max(12),
  seasons: z.array(seasonSchema).max(12),
  childPercent: z.number().int().min(0).max(100), // child 5–11 sharing parents' room, % of adult price
  gstPercent: z.number().min(0).max(28),
  photos: z.array(photoSchema).max(16),
  mapStops: z.array(mapStopSchema).max(12),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(170).default(""),
});

export type PackageContent = z.infer<typeof packageContentSchema>;
export type Season = z.infer<typeof seasonSchema>;
export type Theme = (typeof THEMES)[number];

export function emptyContent(): PackageContent {
  return {
    title: "",
    summary: "",
    region: "Kerala",
    destinations: [],
    durationDays: 4,
    themes: [],
    highlights: [],
    itinerary: [],
    inclusions: [],
    exclusions: [],
    hotels: [],
    seasons: [],
    childPercent: 50,
    gstPercent: 5,
    photos: [],
    mapStops: [],
    seoTitle: "",
    seoDescription: "",
  };
}

export type Problem = { field: string; message: string; level: "error" | "warning" };

/** Checks that only matter at publish time. Errors block publishing; warnings are shown. */
export function publishProblems(c: PackageContent, seasonCoverage: (s: Season[]) => { gaps: string[]; overlaps: string[] }): Problem[] {
  const p: Problem[] = [];
  if (!c.summary) p.push({ field: "summary", message: "Add a one-line summary for listings and search results.", level: "error" });
  if (c.destinations.length === 0) p.push({ field: "destinations", message: "Add at least one destination.", level: "error" });
  if (c.photos.length === 0) p.push({ field: "photos", message: "Add at least one photo; the first one is the cover.", level: "error" });
  if (c.seasons.length === 0) p.push({ field: "seasons", message: "Add at least one seasonal price.", level: "error" });
  if (c.itinerary.length !== c.durationDays)
    p.push({ field: "itinerary", message: `Itinerary has ${c.itinerary.length} day(s) but the package is ${c.durationDays} days.`, level: "error" });
  c.itinerary.forEach((d, i) => {
    if (d.day !== i + 1) p.push({ field: "itinerary", message: `Day ${i + 1} is numbered ${d.day}.`, level: "error" });
  });
  const { gaps, overlaps } = seasonCoverage(c.seasons);
  for (const o of overlaps) p.push({ field: "seasons", message: `Seasons overlap on ${o}, so the price would be ambiguous.`, level: "error" });
  for (const g of gaps) p.push({ field: "seasons", message: `No price for ${g}. The site will show "price on request" for those dates.`, level: "warning" });
  if (c.photos.some((ph) => !ph.alt)) p.push({ field: "photos", message: "Some photos have no description (alt text).", level: "warning" });
  if (!c.seoDescription) p.push({ field: "seo", message: "No search description; the summary will be used.", level: "warning" });
  return p;
}
