import { REGIONS } from "./package-content";

export type Region = (typeof REGIONS)[number];

export const REGION_INFO: Record<Region, { slug: string; photo: string; blurb: string }> = {
  Kerala: { slug: "kerala", photo: "/photos/kumarakom-backwaters.jpg", blurb: "Backwaters, tea hills, spice forests and a long, quiet coast." },
  "Tamil Nadu": { slug: "tamil-nadu", photo: "/photos/madurai-temple.jpg", blurb: "Temple towns, Nilgiri hill stations and the tip of India." },
  Karnataka: { slug: "karnataka", photo: "/photos/coorg.jpg", blurb: "Coffee country, royal Mysore and the ruins of Hampi." },
  Puducherry: { slug: "puducherry", photo: "/photos/pondicherry.jpg", blurb: "French-quarter streets and the Coromandel coast." },
};

export const regionSlug = (r: string) => REGION_INFO[r as Region]?.slug ?? r.toLowerCase().replace(/\s+/g, "-");
export const regionFromSlug = (slug: string): Region | null => (Object.entries(REGION_INFO).find(([, v]) => v.slug === slug)?.[0] as Region) ?? null;
