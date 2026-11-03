"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, RotateCcw } from "lucide-react";
import { confirmFieldsAction } from "@/app/admin/actions";
import { FX_TO_INR, LOW_CONFIDENCE, type ExtractedFields, type FieldKey, type Span } from "@/lib/ai/extract";
import { THEMES, type Theme } from "@/lib/package-content";
import { Alert, Badge, Button, Card, Spinner, inputClass, cx } from "@/components/ui";
import { Confidence } from "@/components/admin/bits";

type Values = {
  adults: string; children: string; start: string; end: string; month: string; flexible: boolean;
  nightsMin: string; nightsMax: string; destinations: string;
  budgetAmount: string; currency: "INR" | "USD" | "EUR" | "GBP"; basis: "total" | "per_person"; limit: "around" | "max" | "exact";
  mustHaves: Theme[]; interests: Theme[]; hotelCategory: string;
};

function toValues(f: ExtractedFields): Values {
  return {
    adults: f.adults ? String(f.adults.value) : "",
    children: f.children ? String(f.children.value) : "",
    start: f.travelDates?.value.start ?? "",
    end: f.travelDates?.value.end ?? "",
    month: f.travelDates?.value.month ?? "",
    flexible: f.travelDates?.value.flexible ?? false,
    nightsMin: f.nights ? String(f.nights.value.min) : "",
    nightsMax: f.nights ? String(f.nights.value.max) : "",
    destinations: f.destinations?.value.join(", ") ?? "",
    budgetAmount: f.budget ? String(f.budget.value.amount) : "",
    currency: f.budget?.value.currency ?? "INR",
    basis: f.budget?.value.basis ?? "total",
    limit: f.budget?.value.limit ?? "around",
    mustHaves: f.mustHaves?.value ?? [],
    interests: f.interests?.value ?? [],
    hotelCategory: f.hotelCategory?.value ?? "",
  };
}

function toPayload(v: Values) {
  const int = (s: string) => (s.trim() === "" ? null : Math.round(Number(s)));
  const month = v.start ? v.start.slice(0, 7) : v.month || null;
  const nMin = int(v.nightsMin);
  const nMax = int(v.nightsMax) ?? nMin;
  const amount = v.budgetAmount.trim() === "" ? null : Number(v.budgetAmount);
  return {
    adults: int(v.adults),
    children: int(v.children),
    travelDates: v.start || month ? { start: v.start || null, end: v.end || null, month, flexible: v.flexible } : null,
    nights: nMin ? { min: nMin, max: Math.max(nMin, nMax ?? nMin) } : null,
    destinations: v.destinations.split(",").map((x) => x.trim()).filter(Boolean),
    budget: amount ? { amount, currency: v.currency, basis: v.basis, limit: v.limit, inr: Math.round(amount * FX_TO_INR[v.currency]) } : null,
    mustHaves: v.mustHaves,
    interests: v.interests,
    hotelCategory: v.hotelCategory || null,
  };
}

/** Splits the message into plain text and highlighted evidence, tagging each mark with its fields. */
function segments(message: string, fields: ExtractedFields) {
  const marks: { span: Span; key: FieldKey }[] = [];
  for (const [k, f] of Object.entries(fields) as [FieldKey, ExtractedFields[FieldKey]][]) for (const s of f?.evidence ?? []) if (s.end > s.start && s.end <= message.length) marks.push({ span: s, key: k });
  const cuts = new Set([0, message.length]);
  for (const m of marks) cuts.add(m.span.start).add(m.span.end);
  const points = [...cuts].sort((a, b) => a - b);
  const out: { text: string; keys: FieldKey[] }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    out.push({ text: message.slice(a, b), keys: marks.filter((m) => m.span.start <= a && m.span.end >= b).map((m) => m.key) });
  }
  return out;
}

function Row({ k, label, f, active, setActive, children }: { k: FieldKey; label: string; f: ExtractedFields[FieldKey]; active: FieldKey | null; setActive: (k: FieldKey | null) => void; children: React.ReactNode }) {
  const weak = !f || f.confidence < LOW_CONFIDENCE;
  return (
    <div
      onMouseEnter={() => setActive(k)}
      onMouseLeave={() => setActive(null)}
      onFocus={() => setActive(k)}
      className={cx("grid gap-2 border-l-2 py-3 pl-3 sm:grid-cols-[120px_1fr] sm:items-start sm:gap-4", weak ? "border-warn" : "border-transparent", active === k && "bg-paper")}
    >
      <div className="flex items-center gap-2 sm:block">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        <div className="sm:mt-1">{f ? <Confidence value={f.confidence} /> : <Badge tone="warn">Not found</Badge>}</div>
      </div>
      <div className="min-w-0">
        {children}
        {f?.note && <p className="mt-1 text-xs text-muted">{f.note}</p>}
      </div>
    </div>
  );
}

export function ExtractionPanel(props: {
  id: string; message: string; fields: ExtractedFields; engine: string; warnings: string[]; questions: string[]; confirmedAt: string | null; createdAt: string;
  requestedPackage: { id: string; title: string; slug: string } | null; form: { date: string | null; adults: number | null; children: number | null };
}) {
  const { fields } = props;
  const router = useRouter();
  const initial = useMemo(() => toValues(fields), [fields]);
  const [v, setV] = useState<Values>(initial);
  const [active, setActive] = useState<FieldKey | null>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((x) => ({ ...x, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const segs = useMemo(() => segments(props.message, fields), [props.message, fields]);
  const weakCount = (Object.values(fields) as ExtractedFields[FieldKey][]).filter((f) => f && f.confidence < LOW_CONFIDENCE).length;

  const toggle = (k: "mustHaves" | "interests", t: Theme) => set(k, v[k].includes(t) ? v[k].filter((x) => x !== t) : [...v[k], t]);
  const confirm = () =>
    start(async () => {
      const r = await confirmFieldsAction(props.id, toPayload(v));
      setResult(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <Card>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium text-ink">Original message</h2>
          <p className="tabular text-xs text-muted">{new Date(props.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
          {segs.map((s, i) => (s.keys.length ? <mark key={i} className="evidence" data-active={active ? s.keys.includes(active) : false}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
        </p>
        {(props.form.date || props.form.adults || props.requestedPackage) && (
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {props.requestedPackage && <span>Asked about <Link className="text-accent hover:underline" href={`/packages/${props.requestedPackage.slug}`} target="_blank">{props.requestedPackage.title}</Link></span>}
            {props.form.adults ? <span>Form: {props.form.adults} adults, {props.form.children ?? 0} children</span> : null}
            {props.form.date && <span>Form date: {props.form.date}</span>}
          </p>
        )}
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-medium text-ink"><Bot size={17} className="text-muted" /> What the assistant read</h2>
          <span className="text-xs text-muted">{props.engine === "rules+llm" ? "Rules engine + language model" : "Rules engine"}{props.confirmedAt && " · checked by a consultant"}</span>
        </div>
        <p className="mt-1 text-sm text-muted">Hover a field to see the words it came from. Amber means check it. Nothing is sent until you press Send.</p>
        <div className="mt-3 space-y-2">
          {props.warnings.map((w) => <Alert key={w} tone="warn">{w}</Alert>)}
          {weakCount > 0 && !props.confirmedAt && <Alert tone="warn"><span className="inline-flex items-center gap-1.5"><AlertTriangle size={14} /> {weakCount} field{weakCount > 1 ? "s" : ""} need a check before you rely on the suggestions.</span></Alert>}
        </div>

        <div className="mt-2 divide-y divide-line">
          <Row k="adults" label="Adults" f={fields.adults} active={active} setActive={setActive}>
            <input type="number" min={1} aria-label="Adults" value={v.adults} onChange={(e) => set("adults", e.target.value)} className={cx(inputClass, "w-28")} />
          </Row>
          <Row k="children" label="Children" f={fields.children} active={active} setActive={setActive}>
            <input type="number" min={0} aria-label="Children" value={v.children} onChange={(e) => set("children", e.target.value)} className={cx(inputClass, "w-28")} />
          </Row>
          <Row k="travelDates" label="Dates" f={fields.travelDates} active={active} setActive={setActive}>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" aria-label="Start date" value={v.start} onChange={(e) => set("start", e.target.value)} className={cx(inputClass, "w-auto")} />
              <span className="text-muted">to</span>
              <input type="date" aria-label="End date" value={v.end} onChange={(e) => set("end", e.target.value)} className={cx(inputClass, "w-auto")} />
              {!v.start && (
                <>
                  <span className="text-xs text-muted">or month</span>
                  <input type="month" aria-label="Month" value={v.month} onChange={(e) => set("month", e.target.value)} className={cx(inputClass, "w-auto")} />
                </>
              )}
            </div>
          </Row>
          <Row k="nights" label="Nights" f={fields.nights} active={active} setActive={setActive}>
            <div className="flex items-center gap-2">
              <input type="number" min={1} aria-label="Minimum nights" value={v.nightsMin} onChange={(e) => set("nightsMin", e.target.value)} className={cx(inputClass, "w-24")} />
              <span className="text-muted">to</span>
              <input type="number" min={1} aria-label="Maximum nights" value={v.nightsMax} onChange={(e) => set("nightsMax", e.target.value)} className={cx(inputClass, "w-24")} />
            </div>
          </Row>
          <Row k="destinations" label="Places" f={fields.destinations} active={active} setActive={setActive}>
            <input aria-label="Destinations, comma separated" value={v.destinations} onChange={(e) => set("destinations", e.target.value)} placeholder="Kerala, Munnar" className={inputClass} />
          </Row>
          <Row k="budget" label="Budget" f={fields.budget} active={active} setActive={setActive}>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Budget limit" value={v.limit} onChange={(e) => set("limit", e.target.value as Values["limit"])} className={cx(inputClass, "w-auto")}>
                <option value="around">around</option><option value="max">up to</option><option value="exact">exactly</option>
              </select>
              <select aria-label="Currency" value={v.currency} onChange={(e) => set("currency", e.target.value as Values["currency"])} className={cx(inputClass, "w-auto")}>
                {(["INR", "USD", "EUR", "GBP"] as const).map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="number" min={0} aria-label="Budget amount" value={v.budgetAmount} onChange={(e) => set("budgetAmount", e.target.value)} className={cx(inputClass, "w-36")} />
              <select aria-label="Budget basis" value={v.basis} onChange={(e) => set("basis", e.target.value as Values["basis"])} className={cx(inputClass, "w-auto")}>
                <option value="total">in total</option><option value="per_person">per person</option>
              </select>
            </div>
          </Row>
          {(["mustHaves", "interests"] as const).map((k) => (
            <Row key={k} k={k} label={k === "mustHaves" ? "Must-haves" : "Interests"} f={fields[k]} active={active} setActive={setActive}>
              <div className="flex flex-wrap gap-1.5">
                {THEMES.filter((t) => t !== "family" && t !== "honeymoon").map((t) => (
                  <button key={t} type="button" aria-pressed={v[k].includes(t)} onClick={() => toggle(k, t)} className={cx("rounded-full border px-2.5 py-1 text-xs capitalize transition-colors", v[k].includes(t) ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:border-line-strong")}>
                    {t}
                  </button>
                ))}
              </div>
            </Row>
          ))}
          <Row k="hotelCategory" label="Hotels" f={fields.hotelCategory} active={active} setActive={setActive}>
            <select aria-label="Hotel class" value={v.hotelCategory} onChange={(e) => set("hotelCategory", e.target.value)} className={cx(inputClass, "w-auto")}>
              <option value="">No preference</option>{["3 star", "4 star", "5 star", "Heritage"].map((h) => <option key={h}>{h}</option>)}
            </select>
          </Row>
        </div>

        {props.questions.length > 0 && !props.confirmedAt && (
          <div className="mt-4 rounded-lg bg-sand/70 p-3 text-sm">
            <p className="font-medium text-ink-2">The draft will ask the traveller:</p>
            <ul className="mt-1 list-disc pl-5 text-muted">{props.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={confirm} disabled={pending}>{pending ? <Spinner /> : <CheckCircle2 size={16} />} {dirty ? "Save corrections" : "Confirm details"}</Button>
          {dirty && <Button variant="ghost" onClick={() => setV(initial)} disabled={pending}><RotateCcw size={14} /> Undo changes</Button>}
          {result && <span role="status" className={cx("text-sm", result.ok ? "text-ok" : "text-danger")}>{result.text}</span>}
        </div>
      </div>
    </Card>
  );
}
