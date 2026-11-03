import type { Theme } from "../package-content";
import { PLACES, REGION_ALIASES, THEME_KEYWORDS } from "./gazetteer";

/**
 * Rules-based enquiry extraction. Deterministic, explainable, and runs with no API key.
 * Every field carries a confidence (0–1) and the character spans of the text it came from,
 * so the inbox can highlight the evidence beside the extracted value. When an LLM is
 * configured, its answer is merged with this one in `merge.ts`; it never replaces it blindly.
 */

export type Span = { start: number; end: number };
export type Field<T> = { value: T; confidence: number; evidence: Span[]; note?: string };

export type Currency = "INR" | "USD" | "EUR" | "GBP";
export type TripType = "family" | "honeymoon" | "couple" | "group" | "friends" | "solo";
export type TravelDates = { start: string | null; end: string | null; month: string | null; flexible: boolean };
export type Budget = { amount: number; currency: Currency; basis: "total" | "per_person"; limit: "around" | "max" | "exact"; inr: number };

export type ExtractedFields = {
  adults: Field<number> | null;
  children: Field<number> | null;
  travelDates: Field<TravelDates> | null;
  nights: Field<{ min: number; max: number }> | null;
  destinations: Field<string[]> | null;
  budget: Field<Budget> | null;
  mustHaves: Field<Theme[]> | null;
  interests: Field<Theme[]> | null;
  tripType: Field<TripType> | null;
  hotelCategory: Field<string> | null;
};

export type FieldKey = keyof ExtractedFields;

export type Extraction = {
  fields: ExtractedFields;
  /** Things a consultant should ask about, in plain English. */
  questions: string[];
  warnings: string[];
  contact: { email?: string; phone?: string };
  engine: "rules" | "rules+llm";
};

/** Assumed conversion rates for foreign-currency budgets (labelled as an assumption in the UI). */
export const FX_TO_INR: Record<Currency, number> = { INR: 1, USD: 84, EUR: 91, GBP: 107 };

export const QUOTE_FIELDS: FieldKey[] = ["adults", "travelDates", "nights", "destinations"];
export const LOW_CONFIDENCE = 0.7;

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};
const NUM = `(\\d{1,3}|${Object.keys(NUMBER_WORDS).join("|")})`;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};
const MONTH = `(${Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|")})`;
const ORD = "(?:st|nd|rd|th)?";

function toNum(s: string): number {
  return /^\d/.test(s) ? Number(s) : NUMBER_WORDS[s];
}

function* matches(re: RegExp, text: string) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (let m = g.exec(text); m; m = g.exec(text)) {
    yield m;
    if (m[0].length === 0) g.lastIndex++;
  }
}

const span = (m: RegExpExecArray): Span => ({ start: m.index, end: m.index + m[0].length });
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function validDate(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Next occurrence of month/day on or after `today` when the year is not given. */
function inferYear(m: number, d: number, today: Date): number {
  const y = today.getUTCFullYear();
  const candidate = Date.UTC(y, m - 1, d);
  const t = Date.UTC(y, today.getUTCMonth(), today.getUTCDate());
  return candidate >= t ? y : y + 1;
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Clauses split on punctuation and "but", so "houseboat a must" binds to its own clause. */
function clauseAround(text: string, at: number): string {
  const left = Math.max(text.lastIndexOf(".", at), text.lastIndexOf(",", at), text.lastIndexOf(";", at), text.lastIndexOf("\n", at), text.lastIndexOf("!", at), text.lastIndexOf("?", at));
  const rightCandidates = [".", ",", ";", "\n", "!", "?"].map((c) => text.indexOf(c, at)).filter((i) => i >= 0);
  const right = rightCandidates.length ? Math.min(...rightCandidates) : text.length;
  return text.slice(left + 1, right);
}

function extractTravellers(t: string, f: ExtractedFields, questions: string[]) {
  let adults: Field<number> | null = null;
  let children: Field<number> | null = null;

  // "2A+1C", "2a 1c"
  for (const m of matches(/\b(\d{1,2})\s*a\s*\+?\s*(\d{1,2})\s*c\b/, t)) {
    adults = { value: Number(m[1]), confidence: 0.9, evidence: [span(m)] };
    children = { value: Number(m[2]), confidence: 0.9, evidence: [span(m)] };
  }
  for (const m of matches(new RegExp(`\\b${NUM}\\s+(?:adults?|grown[- ]?ups?|elders?)\\b`), t)) {
    adults = { value: toNum(m[1]), confidence: 0.95, evidence: [span(m)] };
  }
  for (const m of matches(new RegExp(`\\b${NUM}\\s+(?:kids?|children|child|toddlers?|infants?|babies|baby|sons?|daughters?)\\b`), t)) {
    const v = toNum(m[1]);
    children = { value: (children?.value && children.evidence[0]?.start !== m.index ? children.value : 0) + v, confidence: m[1] === "a" || m[1] === "an" ? 0.85 : 0.95, evidence: [...(children?.evidence ?? []), span(m)] };
  }
  // Children's ages: "aged 6 and 9", "8 year old", "8yo"
  const ages: number[] = [];
  for (const m of matches(/\b(?:aged?|ages)\s+(\d{1,2})(?:\s*(?:,|and|&)\s*(\d{1,2}))*(?:\s*(?:,|and|&)\s*(\d{1,2}))?/, t)) {
    for (const g of m.slice(1)) if (g) ages.push(Number(g));
    if (children) children.evidence.push(span(m));
  }
  for (const m of matches(/\b(\d{1,2})\s*(?:-|\s)?(?:year|yr)s?[- ]old\b|\b(\d{1,2})\s*yo\b/, t)) {
    ages.push(Number(m[1] ?? m[2]));
    if (children) children.evidence.push(span(m));
  }
  const childAges = ages.filter((a) => a < 18);
  if (!children && childAges.length) children = { value: childAges.length, confidence: 0.75, evidence: [] };
  if (children && childAges.length) {
    const under5 = childAges.filter((a) => a < 5).length;
    children.note = `Ages ${childAges.join(", ")}` + (under5 ? `; ${under5} under 5 (usually free)` : "");
  }

  // Totals: "we are 4", "family of 4", "group of 18", "4 people"
  let total: { value: number; span: Span } | null = null;
  for (const m of matches(new RegExp(`\\b(?:family|group|party|team|batch) of ${NUM}\\b|\\bwe are ${NUM}\\b|\\b${NUM}\\s+(?:people|persons|pax|travell?ers|guests|members|of us)\\b`), t)) {
    const n = toNum(m[1] ?? m[2] ?? m[3]);
    if (n) total = { value: n, span: span(m) };
  }

  if (!adults && total) {
    const kids = children?.value ?? 0;
    adults = {
      value: Math.max(1, total.value - kids),
      confidence: kids ? 0.75 : 0.6,
      evidence: [total.span],
      note: kids ? `${total.value} in total minus ${kids} child(ren)` : `${total.value} travellers; assumed all adults`,
    };
  }
  if (!adults) {
    const couple = /\b(?:a couple|we are a couple|my (?:wife|husband|partner|fianc[ée]e?)|me and my (?:wife|husband|partner)|honeymoon|the two of us|both of us)\b/.exec(t);
    const solo = /\b(?:solo|just me|travell?ing alone|by myself|only me)\b/.exec(t);
    if (couple) adults = { value: 2, confidence: 0.7, evidence: [span(couple)], note: "Inferred from wording" };
    else if (solo) adults = { value: 1, confidence: 0.75, evidence: [span(solo)], note: "Inferred from wording" };
  }
  if (!children) {
    const vague = /\b(?:kids|children|child|baby|toddler)\b/.exec(t);
    if (vague) questions.push("How many children are travelling, and how old are they?");
  } else if (!children.note) {
    questions.push(`How old ${children.value === 1 ? "is the child" : "are the children"}? Children under 5 usually travel free.`);
  }
  f.adults = adults;
  f.children = children;
}

function extractDates(t: string, today: Date, f: ExtractedFields) {
  const found: { start: string; end: string | null; ev: Span; conf: number; note?: string }[] = [];

  // ISO dates
  const isoMatches = [...matches(/\b(20\d\d)-(\d\d)-(\d\d)\b/, t)].filter((m) => validDate(+m[1], +m[2], +m[3]));
  if (isoMatches.length) {
    const s = isoMatches[0];
    const e = isoMatches[1];
    found.push({ start: iso(+s[1], +s[2], +s[3]), end: e ? iso(+e[1], +e[2], +e[3]) : null, ev: span(s), conf: 0.95 });
  }

  // "20-26 Dec", "28 Dec to 3 Jan", "20th to 26th of December 2026"
  const range = new RegExp(`\\b(\\d{1,2})${ORD}\\s*(?:of\\s+)?${MONTH}?\\s*(?:-|–|to|till|until|through)\\s*(\\d{1,2})${ORD}\\s*(?:of\\s+)?${MONTH}\\.?(?:,?\\s*(20\\d\\d))?`);
  for (const m of matches(range, t)) {
    const d1 = +m[1], d2 = +m[3];
    const m2 = MONTHS[m[4]], m1 = m[2] ? MONTHS[m[2]] : m2;
    const y1 = m[5] ? +m[5] - (m1 > m2 ? 1 : 0) : inferYear(m1, d1, today);
    const y2 = m1 > m2 ? y1 + 1 : y1;
    if (validDate(y1, m1, d1) && validDate(y2, m2, d2)) found.push({ start: iso(y1, m1, d1), end: iso(y2, m2, d2), ev: span(m), conf: 0.95 });
  }
  // "Dec 20-26", "December 20 to 26"
  for (const m of matches(new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})${ORD}\\s*(?:-|–|to|till|until)\\s*(\\d{1,2})${ORD}\\b(?:,?\\s*(20\\d\\d))?`), t)) {
    const mo = MONTHS[m[1]], d1 = +m[2], d2 = +m[3];
    const y = m[4] ? +m[4] : inferYear(mo, d1, today);
    if (validDate(y, mo, d1) && validDate(y, mo, d2) && d2 > d1) found.push({ start: iso(y, mo, d1), end: iso(y, mo, d2), ev: span(m), conf: 0.9 });
  }
  if (found.length === 0) {
    // Single day: "20 Dec", "20th of December", "December 20th"
    for (const m of matches(new RegExp(`\\b(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MONTH}\\b\\.?(?:,?\\s*(20\\d\\d))?|\\b${MONTH}\\.?\\s+(\\d{1,2})${ORD}\\b(?:,?\\s*(20\\d\\d))?`), t)) {
      const d = +(m[1] ?? m[5]);
      const mo = MONTHS[m[2] ?? m[4]];
      const yr = m[3] ?? m[6];
      // "may 5" alone is risky ("may" the verb), so require "may" to look like a date.
      if ((m[2] ?? m[4]) === "may" && !yr && !/\b(?:in|on|from|of|\d)\s*(?:may|\d)/.test(m[0])) continue;
      const y = yr ? +yr : inferYear(mo, d, today);
      if (validDate(y, mo, d)) found.push({ start: iso(y, mo, d), end: null, ev: span(m), conf: 0.9 });
    }
  }
  if (found.length === 0) {
    // Numeric dd/mm(/yy) — read Indian style, flagged because foreign guests may write mm/dd.
    // Dots only with a full year, so "1.2 lakh" is never read as a date.
    for (const m of matches(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b|\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/, t)) {
      const d = +(m[1] ?? m[4]), mo = +(m[2] ?? m[5]);
      const yr = m[3] ?? m[6];
      const y = yr ? (yr.length === 2 ? 2000 + +yr : +yr) : inferYear(mo, d, today);
      if (mo <= 12 && validDate(y, mo, d)) {
        found.push({ start: iso(y, mo, d), end: null, ev: span(m), conf: d <= 12 ? 0.55 : 0.8, note: "Read as day/month" });
        break;
      }
    }
  }

  const flexible = /\b(?:flexible|any ?time|sometime|whenever|open dates)\b/.test(t);

  if (found.length) {
    const first = found[0];
    const end = first.end ?? found[1]?.start ?? null;
    f.travelDates = {
      value: { start: first.start, end: end && end > first.start ? end : null, month: first.start.slice(0, 7), flexible },
      confidence: first.conf,
      evidence: found.slice(0, 2).map((x) => x.ev),
      note: first.note,
    };
    return;
  }

  // Holidays
  const holiday = /\b(christmas|xmas|new year'?s?(?: eve)?|pongal|onam)\b/.exec(t);
  // Month only: "in December", "December 2026", "early Jan". "may" needs a preposition.
  let monthMatch: RegExpExecArray | null = null;
  for (const m of matches(new RegExp(`\\b(?:(in|during|for|this|next|early|mid|late|end of|start of|beginning of|around|of)\\s+)?${MONTH}\\b(?:\\s+(20\\d\\d))?`), t)) {
    if (m[2] === "may" && !m[1] && !m[3]) continue;
    if (m[2] === "march" && !m[1] && !m[3]) continue;
    monthMatch = m;
    break;
  }
  if (monthMatch) {
    const mo = MONTHS[monthMatch[2]];
    // A month without a year means its next occurrence; the current month counts.
    const y = monthMatch[3] ? +monthMatch[3] : mo >= today.getUTCMonth() + 1 ? today.getUTCFullYear() : today.getUTCFullYear() + 1;
    f.travelDates = {
      value: { start: null, end: null, month: `${y}-${pad(mo)}`, flexible: true },
      confidence: monthMatch[3] ? 0.9 : 0.85,
      evidence: [span(monthMatch)],
      note: monthMatch[3] ? undefined : `Year assumed ${y}`,
    };
    return;
  }
  if (holiday) {
    const h = holiday[1];
    const [mo, d] = h.startsWith("new year") ? [12, 30] : h === "pongal" ? [1, 14] : h === "onam" ? [9, 1] : [12, 23];
    const y = inferYear(mo, d, today);
    f.travelDates = {
      value: { start: iso(y, mo, d), end: null, month: `${y}-${pad(mo)}`, flexible: true },
      confidence: 0.6,
      evidence: [span(holiday)],
      note: `Assumed start around ${d}/${mo} for "${h}"`,
    };
    return;
  }
  const rel = /\b(next|this) month\b/.exec(t);
  if (rel) {
    const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + (rel[1] === "next" ? 1 : 0), 1));
    f.travelDates = {
      value: { start: null, end: null, month: `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}`, flexible: true },
      confidence: 0.8,
      evidence: [span(rel)],
    };
  }
}

function extractNights(t: string, f: ExtractedFields) {
  const n = (s: string) => toNum(s);
  let r: Field<{ min: number; max: number }> | null = null;
  const tries: [RegExp, (m: RegExpExecArray) => [number, number], number][] = [
    [/\b(\d{1,2})\s*d\s*\/?\s*(\d{1,2})\s*n\b/, (m) => [+m[2], +m[2]], 0.95],
    [/\b(\d{1,2})\s*n\s*\/?\s*(\d{1,2})\s*d\b/, (m) => [+m[1], +m[1]], 0.95],
    [new RegExp(`\\b${NUM}\\s*(?:-|–|to|or)\\s*${NUM}\\s*nights?\\b`), (m) => [n(m[1]), n(m[2])], 0.95],
    [new RegExp(`\\b${NUM}\\s*nights?\\b`), (m) => [n(m[1]), n(m[1])], 0.95],
    [/\b(\d{1,2})\s*n\b/, (m) => [+m[1], +m[1]], 0.85],
    [new RegExp(`\\b${NUM}\\s*(?:-|–|to|or)\\s*${NUM}\\s*days?\\b`), (m) => [n(m[1]) - 1, n(m[2]) - 1], 0.8],
    [new RegExp(`(?<!in |after |within )\\b${NUM}\\s*days?\\b(?! ago)`), (m) => [n(m[1]) - 1, n(m[1]) - 1], 0.8],
    [/\b(?:a|one) week\b/, () => [7, 7], 0.75],
    [/\b(?:two weeks|2 weeks|a fortnight|fortnight)\b/, () => [14, 14], 0.75],
    [/\b(?:long )?weekend\b/, (m) => (m[0].startsWith("long") ? [3, 3] : [2, 2]), 0.6],
  ];
  for (const [re, fn, conf] of tries) {
    const m = re.exec(t);
    if (m) {
      const [a, b] = fn(m);
      if (a >= 1 && b >= a && b <= 30) {
        r = { value: { min: a, max: b }, confidence: conf, evidence: [span(m)] };
        if (conf < 0.95 && /days?/.test(m[0])) r.note = "Days converted to nights (days − 1)";
        break;
      }
    }
  }
  const d = f.travelDates?.value;
  if (!r && d?.start && d.end) {
    const k = daysBetween(d.start, d.end);
    if (k >= 1 && k <= 30) r = { value: { min: k, max: k }, confidence: 0.85, evidence: f.travelDates!.evidence, note: "From the travel dates" };
  }
  f.nights = r;
}

function extractDestinations(t: string, f: ExtractedFields) {
  const names: string[] = [];
  const ev: Span[] = [];
  for (const p of PLACES) {
    for (const a of p.aliases) {
      const m = new RegExp(`\\b${a.replace(/ /g, "\\s+")}\\b`).exec(t);
      if (m) {
        if (!names.includes(p.name)) names.push(p.name);
        ev.push(span(m));
        break;
      }
    }
  }
  for (const [alias, region] of Object.entries(REGION_ALIASES)) {
    const m = new RegExp(`\\b${alias.replace(/ /g, "\\s+")}\\b`).exec(t);
    if (m && !names.includes(region)) {
      names.push(region);
      ev.push(span(m));
    }
  }
  if (names.length) f.destinations = { value: names, confidence: 0.95, evidence: ev.sort((a, b) => a.start - b.start) };
}

function parseAmount(raw: string, unit: string | undefined): number {
  const v = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(v)) return NaN;
  switch (unit) {
    case "lakh": case "lakhs": case "lac": case "lacs": case "l": return v * 100_000;
    case "crore": case "cr": return v * 10_000_000;
    case "k": case "thousand": return v * 1_000;
    default: return v;
  }
}

function extractBudget(t: string, f: ExtractedFields) {
  const amt = "(\\d[\\d,]*(?:\\.\\d+)?)";
  const unit = "\\s*(lakhs?|lacs?|l|crore|cr|k|thousand)?\\b";
  const cands: { amount: number; currency: Currency; m: RegExpExecArray; conf: number }[] = [];
  const add = (re: RegExp, currency: Currency | ((m: RegExpExecArray) => Currency), ai: number, ui: number, conf: number) => {
    for (const m of matches(re, t)) {
      const a = parseAmount(m[ai], m[ui]?.toLowerCase());
      if (a > 0) cands.push({ amount: a, currency: typeof currency === "function" ? currency(m) : currency, m, conf });
    }
  };
  add(new RegExp(`(?:₹|\\brs\\.?|\\binr)\\s*${amt}${unit}`), "INR", 1, 2, 0.95);
  add(new RegExp(`\\b${amt}\\s*(lakhs?|lacs?|crore|k)\\b(?!\\s*(?:km|kms|steps))`), "INR", 1, 2, 0.9);
  add(new RegExp(`\\b${amt}${unit}\\s*(?:rupees|inr|rs)\\b`), "INR", 1, 2, 0.95);
  add(new RegExp(`(\\$|us\\$|\\busd|€|\\beur|£|\\bgbp)\\s*${amt}\\s*(k)?\\b`), (m) => cur(m[1]), 2, 3, 0.9);
  add(new RegExp(`\\b${amt}\\s*(k)?\\s*(usd|dollars?|eur|euros?|gbp|pounds?)\\b`), (m) => cur(m[3]), 1, 2, 0.9);
  // "budget is 120000" with no unit
  add(new RegExp(`\\bbudget[^\\d₹$€£\\n]{0,20}${amt}\\b`), "INR", 1, 99, 0.8);

  function cur(s: string): Currency {
    if (/\$|usd|dollar/.test(s)) return "USD";
    if (/€|eur/.test(s)) return "EUR";
    return "GBP";
  }

  const plausible = cands
    .map((c) => ({ ...c, inr: c.amount * FX_TO_INR[c.currency] }))
    .filter((c) => c.inr >= 5_000 && c.inr <= 50_000_000)
    .sort((a, b) => b.conf - a.conf || a.m.index - b.m.index);
  const best = plausible[0];
  if (!best) return;

  const before = t.slice(Math.max(0, best.m.index - 30), best.m.index);
  const after = t.slice(best.m.index + best.m[0].length, best.m.index + best.m[0].length + 35);
  const perPerson = /\b(?:per person|per head|per pax|pp|p\.p\.|each|a head|\/person|\/pax)\b/.test(after) || /\b(?:per person|each)\b[^.]{0,10}$/.test(before);
  const totalWord = /\b(?:total|in total|overall|all inclusive|for (?:all|everyone|the family|us all|both|the group)|altogether)\b/.test(after) || /\btotal\b/.test(before);
  const limit: Budget["limit"] = /\b(?:under|below|max(?:imum)?|within|up ?to|not more than|less than)\b[^\d]{0,12}$/.test(before)
    ? "max"
    : /(?:around|about|approx(?:imately)?|roughly|~|close to|near)[^\d]{0,12}$/.test(before)
      ? "around"
      : "exact";

  const basis: Budget["basis"] = perPerson ? "per_person" : "total";
  let confidence = best.conf;
  let note: string | undefined;
  if (!perPerson && !totalWord) {
    confidence = Math.min(confidence, 0.65);
    note = "Not stated whether total or per person; read as total";
  }
  if (best.currency !== "INR") note = [note, `Converted at assumed ₹${FX_TO_INR[best.currency]}/${best.currency}`].filter(Boolean).join("; ");

  const evEnd = best.m.index + best.m[0].length + (perPerson || totalWord ? (after.match(/^.*?\b(per person|per head|per pax|pp|each|total|in total|overall|for all|altogether)\b/)?.[0].length ?? 0) : 0);
  f.budget = {
    value: { amount: best.amount, currency: best.currency, basis, limit, inr: Math.round(best.inr) },
    confidence,
    evidence: [{ start: best.m.index, end: evEnd }],
    note,
  };
}

const MUST_MARKERS = /\b(?:must|a must|must[- ]have|definitely|need|needs|have to|has to|essential|important|non[- ]negotiable|should include|without fail|compulsory|necessarily)\b/;

function extractThemes(t: string, f: ExtractedFields) {
  const must: Theme[] = [];
  const nice: Theme[] = [];
  const evMust: Span[] = [];
  const evNice: Span[] = [];
  for (const [theme, words] of Object.entries(THEME_KEYWORDS) as [Theme, string[]][]) {
    if (theme === "family" || theme === "honeymoon") continue; // trip types, handled separately
    for (const w of words) {
      const m = new RegExp(`\\b${w.replace(/ /g, "\\s+")}\\b`).exec(t);
      if (!m) continue;
      const clause = clauseAround(t, m.index);
      if (MUST_MARKERS.test(clause)) {
        must.push(theme);
        evMust.push(span(m));
      } else {
        nice.push(theme);
        evNice.push(span(m));
      }
      break;
    }
  }
  if (must.length) f.mustHaves = { value: must, confidence: 0.85, evidence: evMust };
  if (nice.length) f.interests = { value: nice, confidence: 0.8, evidence: evNice };
}

function extractTripType(t: string, f: ExtractedFields) {
  const checks: [TripType, RegExp, number][] = [
    ["honeymoon", /\b(?:honeymoon|newly ?weds?|just married|newly married)\b/, 0.95],
    ["family", /\b(?:family|families|kids?|children|child|parents|in-laws)\b/, 0.85],
    ["group", /\b(?:group|colleagues|office|team|tour group|delegation)\b/, 0.85],
    ["friends", /\b(?:friends|buddies|college gang)\b/, 0.85],
    ["couple", /\b(?:couple|my (?:wife|husband|partner)|anniversary|the two of us)\b/, 0.8],
    ["solo", /\b(?:solo|alone|just me|by myself)\b/, 0.8],
  ];
  for (const [type, re, conf] of checks) {
    const m = re.exec(t);
    if (m) {
      f.tripType = { value: type, confidence: conf, evidence: [span(m)] };
      return;
    }
  }
  if (f.children?.value) f.tripType = { value: "family", confidence: 0.8, evidence: f.children.evidence };
}

function extractHotel(t: string, f: ExtractedFields) {
  const star = new RegExp(`\\b(${NUM})\\s*[- ]?star\\b`).exec(t);
  if (star) {
    const n = toNum(star[1]);
    if (n >= 1 && n <= 7) f.hotelCategory = { value: `${n} star`, confidence: 0.95, evidence: [span(star)] };
    return;
  }
  const lux = /\b(?:luxury|luxurious|premium|high[- ]end)\b/.exec(t);
  if (lux) f.hotelCategory = { value: "5 star", confidence: 0.6, evidence: [span(lux)], note: `"${lux[0]}" read as 5 star` };
  const budget = /\b(?:budget hotels?|cheap|economy|basic hotels?)\b/.exec(t);
  if (!lux && budget) f.hotelCategory = { value: "3 star", confidence: 0.55, evidence: [span(budget)], note: `"${budget[0]}" read as 3 star` };
  const heritage = /\bheritage (?:hotel|stay|property|homestay)s?\b/.exec(t);
  if (!lux && !budget && heritage) f.hotelCategory = { value: "Heritage", confidence: 0.85, evidence: [span(heritage)] };
}

function extractContact(raw: string) {
  const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(raw)?.[0];
  const phone = /(?:\+?\d[\d\s-]{8,14}\d)/.exec(raw)?.[0]?.replace(/[\s-]/g, "");
  return { email, phone: phone && phone.replace(/\D/g, "").length >= 10 ? phone : undefined };
}

const FIELD_QUESTIONS: Partial<Record<FieldKey, string>> = {
  adults: "How many adults will be travelling?",
  travelDates: "When would you like to travel? Exact dates help us check hotel availability.",
  nights: "How many nights would you like the trip to be?",
  destinations: "Which places would you like to visit? Or tell us what you enjoy and we will suggest a route.",
  budget: "Do you have a budget in mind, in total or per person?",
};

export function extractRules(message: string, today: Date = new Date()): Extraction {
  const raw = message.normalize("NFKC");
  const lower = raw.toLowerCase();
  // Lower-casing can change string length for a few scripts; spans then can't be trusted.
  const t = lower.length === raw.length ? lower : raw.toLowerCase();
  const spansOk = lower.length === raw.length;
  const fields: ExtractedFields = {
    adults: null, children: null, travelDates: null, nights: null, destinations: null,
    budget: null, mustHaves: null, interests: null, tripType: null, hotelCategory: null,
  };
  const questions: string[] = [];
  const warnings: string[] = [];

  extractTravellers(t, fields, questions);
  extractDates(t, today, fields);
  extractNights(t, fields);
  extractDestinations(t, fields);
  extractBudget(t, fields);
  extractThemes(t, fields);
  extractTripType(t, fields);
  extractHotel(t, fields);

  if (!spansOk) for (const k of Object.keys(fields) as FieldKey[]) if (fields[k]) fields[k]!.evidence = [];

  const letters = raw.replace(/[^\p{L}]/gu, "");
  const latin = raw.replace(/[^A-Za-z]/g, "");
  if (letters.length > 10 && latin.length / letters.length < 0.6) warnings.push("Message may not be in English; the extraction is likely incomplete. Read the original.");
  if (raw.trim().length < 25) warnings.push("Very short message; most details will need to be asked.");

  for (const k of QUOTE_FIELDS) if (!fields[k]) questions.push(FIELD_QUESTIONS[k]!);
  if (!fields.budget) questions.push(FIELD_QUESTIONS.budget!);
  if (fields.travelDates && !fields.travelDates.value.start) questions.push("Which dates in that month suit you best?");

  return { fields, questions: [...new Set(questions)], warnings, contact: extractContact(raw), engine: "rules" };
}

/** 0–1 score for how much of what we need to quote was found, weighted by confidence. */
export function overallConfidence(f: ExtractedFields): number {
  const weights: Partial<Record<FieldKey, number>> = { adults: 2, travelDates: 2, nights: 1.5, destinations: 2, budget: 1, children: 0.5 };
  let got = 0;
  let total = 0;
  for (const [k, w] of Object.entries(weights) as [FieldKey, number][]) {
    total += w;
    got += w * (f[k]?.confidence ?? 0);
  }
  return Math.round((got / total) * 100) / 100;
}
