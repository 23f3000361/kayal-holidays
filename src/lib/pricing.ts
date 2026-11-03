import type { PackageContent, Season } from "./package-content";

/** Day-of-year index for a recurring MM-DD, using a leap year so 02-29 is valid. */
function mdIndex(md: string): number {
  const [m, d] = md.split("-").map(Number);
  return Math.round((Date.UTC(2024, m - 1, d) - Date.UTC(2024, 0, 1)) / 86_400_000);
}

const DAYS = 366;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function seasonDays(s: Season): Set<number> {
  const a = mdIndex(s.from);
  const b = mdIndex(s.to);
  const days = new Set<number>();
  for (let i = a; ; i = (i + 1) % DAYS) {
    days.add(i);
    if (i === b) break;
  }
  return days;
}

export function formatMonthDay(md: string): string {
  const [m, d] = md.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Human label such as "Oct–Mar" when a season covers whole months, else "15 Dec–5 Jan". */
export function seasonRangeLabel(s: Season): string {
  const [fm, fd] = s.from.split("-").map(Number);
  const [tm, td] = s.to.split("-").map(Number);
  const lastDay = new Date(Date.UTC(2024, tm, 0)).getUTCDate();
  if (fd === 1 && (td === lastDay || (tm === 2 && td >= 28))) {
    if (fm === (tm % 12) + 1) return "All year";
    return fm === tm ? MONTHS[fm - 1] : `${MONTHS[fm - 1]}–${MONTHS[tm - 1]}`;
  }
  return `${formatMonthDay(s.from)}–${formatMonthDay(s.to)}`;
}

/** Which season prices a trip starting on `date` (ISO yyyy-mm-dd). The start date decides the season. */
export function seasonFor(seasons: Season[], date: string): Season | null {
  const md = date.slice(5, 10);
  const idx = mdIndex(md);
  return seasons.find((s) => seasonDays(s).has(idx)) ?? null;
}

/** Gaps (dates with no price) and overlaps (dates with two prices), as readable ranges. */
export function seasonCoverage(seasons: Season[]): { gaps: string[]; overlaps: string[] } {
  if (seasons.length === 0) return { gaps: [], overlaps: [] };
  const count = new Array<number>(DAYS).fill(0);
  for (const s of seasons) for (const d of seasonDays(s)) count[d]++;
  const toRanges = (pred: (n: number) => boolean) => {
    const ranges: string[] = [];
    let start = -1;
    for (let i = 0; i <= DAYS; i++) {
      const hit = i < DAYS && pred(count[i]);
      if (hit && start < 0) start = i;
      if (!hit && start >= 0) {
        ranges.push(rangeLabel(start, i - 1));
        start = -1;
      }
    }
    return ranges;
  };
  return { gaps: toRanges((n) => n === 0), overlaps: toRanges((n) => n > 1) };
}

function rangeLabel(a: number, b: number): string {
  const fmt = (i: number) => {
    const d = new Date(Date.UTC(2024, 0, 1) + i * 86_400_000);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  };
  return a === b ? fmt(a) : `${fmt(a)}–${fmt(b)}`;
}

export function lowestPrice(content: Pick<PackageContent, "seasons">): number | null {
  if (content.seasons.length === 0) return null;
  return Math.min(...content.seasons.map((s) => s.pricePerPerson));
}

export type Party = { adults: number; children: number };

export type QuoteLine = { label: string; qty: number; unit: number; amount: number };
export type PriceBreakdown = {
  season: Season;
  lines: QuoteLine[];
  subtotal: number;
  gstPercent: number;
  gst: number;
  total: number;
};

/**
 * Prices a party for a package on a start date. Adult price is the season's per-person
 * twin-sharing rate; children 5–11 sharing parents' room pay `childPercent` of it.
 * Returns null when no season covers the date ("price on request").
 */
export function priceParty(content: Pick<PackageContent, "seasons" | "childPercent" | "gstPercent">, date: string, party: Party): PriceBreakdown | null {
  const season = seasonFor(content.seasons, date);
  if (!season) return null;
  const adults = Math.max(0, Math.floor(party.adults));
  const children = Math.max(0, Math.floor(party.children));
  const lines: QuoteLine[] = [];
  if (adults > 0) lines.push({ label: "Adult, twin sharing", qty: adults, unit: season.pricePerPerson, amount: adults * season.pricePerPerson });
  if (children > 0) {
    const unit = Math.round((season.pricePerPerson * content.childPercent) / 100);
    lines.push({ label: "Child 5–11, sharing parents' room", qty: children, unit, amount: children * unit });
  }
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const gst = Math.round((subtotal * content.gstPercent) / 100);
  return { season, lines, subtotal, gstPercent: content.gstPercent, gst, total: subtotal + gst };
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export function formatINR(n: number): string {
  return `₹${inr.format(n)}`;
}

/** "₹1.2 lakh" style for compact budget display. */
export function formatLakh(n: number): string {
  if (n >= 10_000_000) return `₹${+(n / 10_000_000).toFixed(2)} crore`;
  if (n >= 100_000) return `₹${+(n / 100_000).toFixed(2)} lakh`;
  return formatINR(n);
}
