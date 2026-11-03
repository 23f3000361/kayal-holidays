import type { PackageContent } from "./package-content";
import { formatINR, seasonRangeLabel } from "./pricing";

/**
 * Versioning model: each package has one mutable draft and a list of immutable releases.
 * A release goes live at its `publishAt` (now, or a scheduled time). The live version is
 * simply the newest release whose time has come, so scheduling needs no background job.
 * "Unpublish" is itself a release with visibility "hidden", which keeps history honest.
 */

export type ReleaseRef = { id: string; versionNo: number; publishAt: Date; visibility: "public" | "hidden" };

export function resolveLive<R extends ReleaseRef>(releases: R[], now: Date): R | null {
  const due = releases.filter((r) => r.publishAt.getTime() <= now.getTime());
  if (due.length === 0) return null;
  const latest = due.reduce((a, b) => (b.publishAt > a.publishAt || (b.publishAt.getTime() === a.publishAt.getTime() && b.versionNo > a.versionNo) ? b : a));
  return latest.visibility === "public" ? latest : null;
}

export function upcoming<R extends ReleaseRef>(releases: R[], now: Date): R[] {
  return releases.filter((r) => r.publishAt > now).sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime());
}

export type Change = { field: string; label: string; before: string; after: string };

const LABELS: Partial<Record<keyof PackageContent, string>> = {
  title: "Title", summary: "Summary", region: "Region", destinations: "Destinations", durationDays: "Length (days)",
  themes: "Themes", highlights: "Highlights", inclusions: "Inclusions", exclusions: "Exclusions", hotels: "Hotels",
  childPercent: "Child price %", gstPercent: "GST %", photos: "Photos", mapStops: "Map stops", seoTitle: "Search title",
  seoDescription: "Search description",
};

const show = (v: unknown): string => {
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.every((x) => typeof x === "string") ? v.join(", ") : `${v.length} item(s)`;
  if (v === "" || v === null || v === undefined) return "—";
  return String(v);
};

/** Readable list of what changed between two versions, for the history screen. */
export function diffContent(a: PackageContent | null, b: PackageContent): Change[] {
  if (!a) return [{ field: "*", label: "Created", before: "—", after: b.title }];
  const out: Change[] = [];
  for (const key of Object.keys(LABELS) as (keyof PackageContent)[]) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      out.push({ field: key, label: LABELS[key]!, before: show(a[key]), after: show(b[key]) });
    }
  }
  // Seasons: report per season, which is what editors care about.
  const byId = new Map(a.seasons.map((s) => [s.id, s]));
  for (const s of b.seasons) {
    const old = byId.get(s.id);
    const label = `${s.name} price (${seasonRangeLabel(s)})`;
    if (!old) out.push({ field: "seasons", label: `New season: ${s.name}`, before: "—", after: `${formatINR(s.pricePerPerson)} · ${seasonRangeLabel(s)}` });
    else {
      if (old.pricePerPerson !== s.pricePerPerson) out.push({ field: "seasons", label, before: formatINR(old.pricePerPerson), after: formatINR(s.pricePerPerson) });
      if (old.from !== s.from || old.to !== s.to) out.push({ field: "seasons", label: `${s.name} dates`, before: seasonRangeLabel(old), after: seasonRangeLabel(s) });
      if (old.name !== s.name || old.hotelCategory !== s.hotelCategory) out.push({ field: "seasons", label: `${old.name} details`, before: `${old.name}, ${old.hotelCategory}`, after: `${s.name}, ${s.hotelCategory}` });
      byId.delete(s.id);
    }
  }
  for (const s of byId.values()) out.push({ field: "seasons", label: `Removed season: ${s.name}`, before: formatINR(s.pricePerPerson), after: "—" });
  // Itinerary: per day
  const days = Math.max(a.itinerary.length, b.itinerary.length);
  for (let i = 0; i < days; i++) {
    const x = a.itinerary[i];
    const y = b.itinerary[i];
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    out.push({ field: "itinerary", label: `Day ${i + 1}`, before: x ? x.title : "—", after: y ? (x && x.title === y.title ? `${y.title} (details edited)` : y.title) : "—" });
  }
  return out;
}
