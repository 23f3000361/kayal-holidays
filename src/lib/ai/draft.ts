import { formatINR, formatLakh } from "../pricing";
import type { ExtractedFields } from "./extract";
import { partyOf, type Suggestion } from "./suggest";

/**
 * Builds the reply a consultant starts from. It is plain text assembled from the extracted
 * fields and the package price table: every rupee figure comes from `priceParty`, never
 * from a language model. Nothing is sent until a consultant presses Send.
 */

export const ACK_TEMPLATE = {
  subject: "We have your enquiry ({ref})",
  body: `Dear {name},

Thank you for writing to Kayal Holidays. Your enquiry reference is {ref}.

A travel consultant will reply within one working hour (Monday to Saturday, 9 am to 7 pm IST) with options and prices for your trip.

Warm regards,
Kayal Holidays, Kochi`,
};

export function fillTemplate(t: string, vars: Record<string, string>): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthPhrase(f: ExtractedFields): string {
  const d = f.travelDates?.value;
  if (!d) return "";
  if (d.start) {
    const s = new Date(d.start + "T00:00:00Z");
    const label = `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`;
    if (d.end) {
      const e = new Date(d.end + "T00:00:00Z");
      return ` from ${label} to ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
    }
    return ` from ${label} ${s.getUTCFullYear()}`;
  }
  if (d.month) {
    const [y, m] = d.month.split("-").map(Number);
    return ` in ${MONTHS[m - 1]} ${y}`;
  }
  return "";
}

function partyPhrase(f: ExtractedFields): string {
  const { adults, children } = partyOf(f);
  const a = `${adults} adult${adults === 1 ? "" : "s"}`;
  return children ? `${a} and ${children} child${children === 1 ? "" : "ren"}` : a;
}

function understanding(f: ExtractedFields): string {
  const bits: string[] = [];
  if (f.adults || f.children) bits.push(partyPhrase(f));
  const n = f.nights?.value;
  if (n) bits.push(n.min === n.max ? `${n.min} nights` : `${n.min}–${n.max} nights`);
  const b = f.budget?.value;
  if (b) {
    const amount = b.currency === "INR" ? formatLakh(b.amount) : `${b.currency} ${b.amount.toLocaleString("en-IN")}`;
    bits.push(`a budget of ${b.limit === "max" ? "up to " : b.limit === "around" ? "around " : ""}${amount}${b.basis === "per_person" ? " per person" : " in total"}`);
  }
  const must = f.mustHaves?.value;
  if (must?.length) bits.push(`${must.join(" and ")} a must`);
  if (f.hotelCategory) bits.push(`${f.hotelCategory.value} hotels`);
  return bits.join(", ");
}

export type DraftInput = { name: string; fields: ExtractedFields; suggestions: Suggestion[]; questions: string[]; consultantName: string; siteUrl: string };

export function draftReply({ name, fields, suggestions, questions, consultantName, siteUrl }: DraftInput): { subject: string; body: string } {
  const where = fields.destinations?.value.length ? fields.destinations.value.join(", ") : "South India";
  const lines: string[] = [];
  lines.push(`Dear ${name.split(" ")[0] || "traveller"},`, "");
  lines.push(`Thank you for your enquiry about a holiday in ${where}${monthPhrase(fields)}.`);
  const u = understanding(fields);
  if (u) lines.push(`You mentioned ${u}.`);
  lines.push("");

  const usable = suggestions.filter((s) => s.score >= 40);
  if (usable.length) {
    lines.push(usable.length === 1 ? "Here is the package that fits best:" : `Here are ${usable.length} packages that fit well:`, "");
    usable.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.title}`);
      if (s.price) {
        const p = s.price;
        const adult = p.lines.find((l) => l.label.startsWith("Adult"));
        const child = p.lines.find((l) => l.label.startsWith("Child"));
        lines.push(`   ${p.season.name} season, ${p.season.hotelCategory} hotels: ${formatINR(adult?.unit ?? p.season.pricePerPerson)} per adult, twin sharing${child ? `; ${formatINR(child.unit)} per child (5–11)` : ""}.`);
        lines.push(`   For ${partyPhrase(fields)}: ${formatINR(p.subtotal)} + ${p.gstPercent}% GST ${formatINR(p.gst)} = ${formatINR(p.total)}.`);
      } else if (s.fromPrice) {
        lines.push(`   From ${formatINR(s.fromPrice)} per person, twin sharing, plus GST. We will confirm the exact price for your dates.`);
      }
      lines.push(`   ${siteUrl.replace(/\/$/, "")}/packages/${s.slug}`, "");
    });
  } else {
    lines.push("None of our standard packages is a close match, so we would be glad to design a custom itinerary for you.", "");
  }

  if (questions.length) {
    lines.push("To confirm the best option and hold hotels, could you tell us:");
    for (const q of questions) lines.push(`- ${q}`);
    lines.push("");
  }
  lines.push("Prices are per person on twin sharing, valid for the season shown, and subject to hotel availability at booking.", "");
  lines.push("Warm regards,", consultantName, "Kayal Holidays, Kochi");

  return { subject: `Your ${where} holiday: options and prices`, body: lines.join("\n") };
}
