import { formatLakh } from "../pricing";
import type { ExtractedFields } from "./extract";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateLabel(d: { start: string | null; end: string | null; month: string | null }): string {
  const f = (iso: string) => {
    const [, m, day] = iso.split("-").map(Number);
    return `${day} ${MONTHS[m - 1]}`;
  };
  if (d.start && d.end) return `${f(d.start)}–${f(d.end)}`;
  if (d.start) return `from ${f(d.start)} ${d.start.slice(0, 4)}`;
  if (d.month) {
    const [y, m] = d.month.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }
  return "";
}

/** Short chips for list views: "2A · 1C", "Dec 2026", "5–6 nights", "Kerala", "~₹1.2 lakh total". */
export function summaryChips(f: ExtractedFields): { text: string; weak: boolean }[] {
  const chips: { text: string; weak: boolean }[] = [];
  const weak = (c?: number) => (c ?? 1) < 0.7;
  if (f.adults || f.children) chips.push({ text: [f.adults ? `${f.adults.value}A` : "?A", f.children?.value ? `${f.children.value}C` : null].filter(Boolean).join(" · "), weak: weak(f.adults?.confidence) });
  if (f.travelDates) chips.push({ text: dateLabel(f.travelDates.value), weak: weak(f.travelDates.confidence) });
  if (f.nights) chips.push({ text: f.nights.value.min === f.nights.value.max ? `${f.nights.value.min}N` : `${f.nights.value.min}–${f.nights.value.max}N`, weak: weak(f.nights.confidence) });
  if (f.destinations) chips.push({ text: f.destinations.value.slice(0, 2).join(", ") + (f.destinations.value.length > 2 ? " +" : ""), weak: weak(f.destinations.confidence) });
  if (f.budget) {
    const b = f.budget.value;
    const amt = b.currency === "INR" ? formatLakh(b.amount) : `${b.currency} ${b.amount.toLocaleString("en-IN")}`;
    chips.push({ text: `${b.limit === "around" ? "~" : b.limit === "max" ? "≤" : ""}${amt}${b.basis === "per_person" ? " pp" : ""}`, weak: weak(f.budget.confidence) });
  }
  if (f.mustHaves) chips.push({ text: `${f.mustHaves.value.join(", ")} must`, weak: weak(f.mustHaves.confidence) });
  return chips;
}
