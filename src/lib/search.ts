import type { PackageContent } from "./package-content";
import { lowestPrice, seasonFor } from "./pricing";
import { PLACES } from "./ai/gazetteer";

export type SearchParams = { q?: string; region?: string; theme?: string; length?: "short" | "medium" | "long" | ""; month?: string };
export type Searchable = { slug: string; content: PackageContent };

export const LENGTHS = { short: [1, 4], medium: [5, 7], long: [8, 30] } as const;

/** Lower-case word stems plus place aliases ("alappuzha" finds Alleppey). */
function haystack(c: PackageContent): string {
  const aliases = PLACES.filter((p) => c.destinations.includes(p.name)).flatMap((p) => p.aliases);
  return [c.title, c.summary, c.region, ...c.destinations, ...aliases, ...c.themes, ...c.highlights].join(" ").toLowerCase();
}

export function searchPackages<T extends Searchable>(items: T[], p: SearchParams): T[] {
  const words = (p.q ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !["and", "the", "in", "for", "with", "trip", "tour", "package", "packages"].includes(w));
  const scored = items
    .filter((it) => {
      const c = it.content;
      if (p.region && c.region !== p.region) return false;
      if (p.theme && !c.themes.includes(p.theme as never)) return false;
      if (p.length && LENGTHS[p.length]) {
        const [a, b] = LENGTHS[p.length];
        if (c.durationDays < a || c.durationDays > b) return false;
      }
      if (p.month && /^\d{1,2}$/.test(p.month)) {
        const md = `2027-${p.month.padStart(2, "0")}-15`;
        if (!seasonFor(c.seasons, md)) return false;
      }
      return true;
    })
    .map((it) => {
      if (!words.length) return { it, score: 1 };
      const hay = haystack(it.content);
      const title = it.content.title.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (title.includes(w)) score += 3;
        else if (hay.includes(w)) score += 1;
        else if (w.length > 4 && hay.includes(w.slice(0, -1))) score += 0.5; // "beaches" -> "beach"
      }
      return { it, score };
    })
    .filter((x) => x.score > 0);
  return scored.sort((a, b) => b.score - a.score || (lowestPrice(a.it.content) ?? 0) - (lowestPrice(b.it.content) ?? 0)).map((x) => x.it);
}
