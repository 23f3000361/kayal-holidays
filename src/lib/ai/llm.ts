import { z } from "zod";
import { THEMES } from "../package-content";
import { FX_TO_INR, type Extraction, type ExtractedFields, type Field, type Span } from "./extract";

/**
 * Optional second opinion from any OpenAI-compatible chat endpoint (set LLM_BASE_URL,
 * LLM_API_KEY, LLM_MODEL). The model only extracts fields; it never writes prices or
 * replies. Its answer is merged with the rules engine field by field:
 *   - both agree      -> confidence goes up
 *   - they disagree   -> the field is flagged for the consultant with both readings
 *   - only the model  -> kept at reduced confidence, lower still if the value can't be
 *                        found in the message (guards against invented details)
 * Any failure (no key, timeout, bad JSON) silently falls back to the rules result.
 */

const llmSchema = z.object({
  adults: z.number().int().min(1).max(200).nullable().optional(),
  children: z.number().int().min(0).max(50).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  nights_min: z.number().int().min(1).max(60).nullable().optional(),
  nights_max: z.number().int().min(1).max(60).nullable().optional(),
  destinations: z.array(z.string()).nullable().optional(),
  budget_amount: z.number().positive().nullable().optional(),
  budget_currency: z.enum(["INR", "USD", "EUR", "GBP"]).nullable().optional(),
  budget_basis: z.enum(["total", "per_person"]).nullable().optional(),
  must_haves: z.array(z.string()).nullable().optional(),
});
export type LlmFields = z.infer<typeof llmSchema>;

export function llmConfigured(): boolean {
  return !!(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);
}

export async function askLlm(message: string, today: Date, timeoutMs = 10_000): Promise<LlmFields | null> {
  if (!llmConfigured()) return null;
  const prompt = `Extract trip details from a travel enquiry to a Kerala and South India tour operator. Today is ${today.toISOString().slice(0, 10)}.
Return only JSON with these keys (use null when not stated; do not guess):
adults, children, start_date (YYYY-MM-DD), end_date, month (YYYY-MM, next occurrence if no year), nights_min, nights_max,
destinations (place or state names as written), budget_amount (a number, convert "1.2 lakh" to 120000), budget_currency (INR|USD|EUR|GBP),
budget_basis (total|per_person), must_haves (from: ${THEMES.join(", ")}; only things the traveller says are essential).`;
  try {
    const res = await fetch(`${process.env.LLM_BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: message.slice(0, 4000) },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const json = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim());
    const parsed = llmSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Where in the message does a value appear? Used to ground model output. */
function locate(message: string, needles: string[]): Span[] {
  const lower = message.toLowerCase();
  const spans: Span[] = [];
  for (const n of needles) {
    if (!n) continue;
    const i = lower.indexOf(n.toLowerCase());
    if (i >= 0) spans.push({ start: i, end: i + n.length });
  }
  return spans;
}

function combine<T>(rules: Field<T> | null, model: T | null, message: string, needles: string[], same: (a: T, b: T) => boolean, show: (v: T) => string): Field<T> | null {
  if (model === null || model === undefined) return rules;
  if (!rules) {
    const evidence = locate(message, needles);
    return { value: model, confidence: evidence.length ? 0.6 : 0.35, evidence, note: evidence.length ? "Found by the language model" : "Language model value not found in the message; check it" };
  }
  if (same(rules.value, model)) return { ...rules, confidence: Math.min(0.99, Math.max(rules.confidence, 0.9)) };
  return { ...rules, confidence: Math.min(rules.confidence, 0.5), note: `Rules read "${show(rules.value)}", language model read "${show(model)}". Please check.` };
}

export function mergeLlm(rules: Extraction, llm: LlmFields | null, message: string): Extraction {
  if (!llm) return rules;
  const f = rules.fields;
  const out: ExtractedFields = { ...f };
  const num = (a: number, b: number) => a === b;
  out.adults = combine(f.adults, llm.adults ?? null, message, [String(llm.adults ?? "")], num, String);
  out.children = combine(f.children, llm.children ?? null, message, [String(llm.children ?? "")], num, String);
  if (llm.nights_min) {
    const v = { min: llm.nights_min, max: llm.nights_max ?? llm.nights_min };
    out.nights = combine(f.nights, v, message, [`${v.min}`], (a, b) => a.min === b.min && a.max === b.max, (x) => (x.min === x.max ? `${x.min} nights` : `${x.min}–${x.max} nights`));
  }
  if (llm.start_date || llm.month) {
    const v = { start: llm.start_date ?? null, end: llm.end_date ?? null, month: llm.month ?? llm.start_date?.slice(0, 7) ?? null, flexible: !llm.start_date };
    out.travelDates = combine(f.travelDates, v, message, [], (a, b) => a.month === b.month && (a.start ?? "") === (b.start ?? ""), (x) => x.start ?? x.month ?? "");
  }
  if (llm.destinations?.length) {
    out.destinations = combine(f.destinations, llm.destinations, message, llm.destinations, (a, b) => a.length === b.length && a.every((x) => b.some((y) => y.toLowerCase() === x.toLowerCase())), (x) => x.join(", "));
  }
  if (llm.budget_amount) {
    const currency = llm.budget_currency ?? "INR";
    const v = { amount: llm.budget_amount, currency, basis: llm.budget_basis ?? "total", limit: "exact" as const, inr: Math.round(llm.budget_amount * FX_TO_INR[currency]) };
    out.budget = combine(f.budget, v, message, [], (a, b) => a.inr === b.inr && a.basis === b.basis, (x) => `${x.currency} ${x.amount} ${x.basis === "per_person" ? "per person" : "total"}`);
  }
  if (llm.must_haves?.length) {
    const valid = llm.must_haves.filter((m): m is (typeof THEMES)[number] => (THEMES as readonly string[]).includes(m));
    if (valid.length) out.mustHaves = combine(f.mustHaves, valid, message, valid, (a, b) => a.length === b.length && a.every((x) => b.includes(x)), (x) => x.join(", "));
  }
  return { ...rules, fields: out, engine: "rules+llm" };
}
