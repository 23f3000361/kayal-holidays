"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ChevronDown, Copy, ExternalLink, FileText, Send, Sparkles } from "lucide-react";
import { quoteAction, sendReplyAction } from "@/app/admin/actions";
import type { Suggestion } from "@/lib/ai/suggest";
import type { Season } from "@/lib/package-content";
import { formatINR, priceParty } from "@/lib/pricing";
import { Alert, Badge, Button, Card, Field, Spinner, inputClass, cx } from "@/components/ui";

type LivePkg = { id: string; code: string; title: string; durationDays: number; seasons: Season[]; childPercent: number; gstPercent: number };
type QuoteRow = { id: string; ref: string; token: string; code: string; total: number; travelDate: string; at: string };

export function WorkPanel(props: {
  id: string; suggestions: Suggestion[]; draft: { subject: string; body: string }; hasEmail: boolean; hasPhone: boolean; whatsappConsent: boolean;
  livePackages: LivePkg[]; quotes: QuoteRow[]; defaults: { adults: number; children: number; date: string }; canQuote: boolean;
}) {
  const [quotePkg, setQuotePkg] = useState(props.suggestions[0]?.packageId ?? props.livePackages[0]?.id ?? "");
  return (
    <div className="space-y-6">
      <Suggestions items={props.suggestions} onQuote={props.canQuote ? setQuotePkg : undefined} />
      <Reply key={props.draft.body} id={props.id} draft={props.draft} hasEmail={props.hasEmail} hasPhone={props.hasPhone} consent={props.whatsappConsent} />
      {props.canQuote && <QuoteBuilder id={props.id} packages={props.livePackages} pkgId={quotePkg} setPkgId={setQuotePkg} defaults={props.defaults} quotes={props.quotes} />}
    </div>
  );
}

function Suggestions({ items, onQuote }: { items: Suggestion[]; onQuote?: (id: string) => void }) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-medium text-ink"><Sparkles size={17} className="text-gold" /> Best-fit packages</h2>
        <span className="text-xs text-muted">Prices from the live price table</span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No live packages to suggest.</p>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((s, i) => (
            <li key={s.packageId} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted"><span className="tabular">{i + 1}.</span> {s.code}</p>
                  <p className="font-medium text-ink">{s.title}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge tone={s.fit === "Strong fit" ? "ok" : s.fit === "Good fit" ? "accent" : "neutral"}>{s.fit}</Badge>
                  <p className="tabular mt-1 text-xs text-muted">score {s.score}/100</p>
                </div>
              </div>
              <div className="mt-2 text-sm">
                {s.price ? (
                  <p className="tabular text-ink-2">{s.price.season.name}: {s.price.lines.map((l) => `${l.qty} × ${formatINR(l.unit)}`).join(" + ")} + GST = <span className="font-medium text-ink">{formatINR(s.price.total)}</span></p>
                ) : (
                  <p className="text-muted">{s.priceDate ? "No price for these dates" : "Dates unknown"}{s.fromPrice ? `; from ${formatINR(s.fromPrice)} per person` : ""}</p>
                )}
              </div>
              {s.warnings.length > 0 && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-warn"><AlertTriangle size={12} /> {s.warnings.join(" · ")}</p>}
              <details className="group mt-2">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted hover:text-ink">Why this score <ChevronDown size={12} className="transition-transform group-open:rotate-180" /></summary>
                <ul className="mt-2 space-y-1">
                  {s.parts.map((p) => (
                    <li key={p.label} className="grid grid-cols-[90px_1fr_48px] items-center gap-2 text-xs">
                      <span className="text-muted">{p.label}</span>
                      <span className="text-ink-2">{p.detail}</span>
                      <span className="tabular text-right text-muted">{p.points}/{p.max}</span>
                    </li>
                  ))}
                </ul>
              </details>
              {onQuote && <button onClick={() => { onQuote(s.packageId); document.getElementById("quote")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="mt-2 text-xs font-medium text-accent hover:underline">Quote this package</button>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Reply({ id, draft, hasEmail, hasPhone, consent }: { id: string; draft: { subject: string; body: string }; hasEmail: boolean; hasPhone: boolean; consent: boolean }) {
  const router = useRouter();
  const canWa = hasPhone && consent;
  const [channel, setChannel] = useState<"email" | "whatsapp">(hasEmail ? "email" : canWa ? "whatsapp" : "email");
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const noRoute = !hasEmail && !canWa;
  const edited = body !== draft.body || subject !== draft.subject;

  const send = () =>
    start(async () => {
      const r = await sendReplyAction(id, { channel, subject, body });
      setConfirming(false);
      setResult(r.ok ? { ok: true, text: r.message ?? "Sent" } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-medium text-ink">Reply</h2>
        <span className="text-xs text-muted">{edited ? "Edited" : "Draft, not sent"}</span>
      </div>
      <div className="space-y-4 px-5 py-4">
        {noRoute && <Alert tone="warn">No email, and no WhatsApp consent on record. Call the traveller, then log the outcome as a note.</Alert>}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Send by">
          {(["email", "whatsapp"] as const).map((c) => {
            const disabled = c === "email" ? !hasEmail : !canWa;
            return (
              <button key={c} type="button" role="radio" aria-checked={channel === c} disabled={disabled} onClick={() => setChannel(c)} className={cx("rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40", channel === c ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink-2")}>
                {c === "email" ? "Email" : "WhatsApp"}
              </button>
            );
          })}
          {hasPhone && !consent && <span className="self-center text-xs text-muted">WhatsApp needs the traveller&apos;s consent</span>}
        </div>
        {channel === "email" && (
          <Field label="Subject" htmlFor="subject"><input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} /></Field>
        )}
        <Field label="Message" htmlFor="body" hint="Every price in this draft is calculated from the package price table. Edit the wording freely; check any number you change.">
          <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={16} className={cx(inputClass, "tabular font-mono text-[13px] leading-relaxed")} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          {!confirming ? (
            <Button onClick={() => setConfirming(true)} disabled={pending || noRoute}><Send size={15} /> Send…</Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft p-2 pl-3">
              <span className="text-sm text-accent">Send by {channel === "email" ? "email" : "WhatsApp"} now?</span>
              <Button size="sm" onClick={send} disabled={pending}>{pending ? <Spinner /> : null} Yes, send</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>Cancel</Button>
            </div>
          )}
          {edited && !confirming && <Button variant="ghost" onClick={() => { setBody(draft.body); setSubject(draft.subject); }}>Reset to draft</Button>}
          <Button variant="ghost" onClick={() => navigator.clipboard.writeText(body)}><Copy size={14} /> Copy</Button>
          {result && <span role="status" className={cx("text-sm", result.ok ? "text-ok" : "text-danger")}>{result.text}</span>}
        </div>
      </div>
    </Card>
  );
}

function QuoteBuilder({ id, packages, pkgId, setPkgId, defaults, quotes }: { id: string; packages: LivePkg[]; pkgId: string; setPkgId: (s: string) => void; defaults: { adults: number; children: number; date: string }; quotes: QuoteRow[] }) {
  const router = useRouter();
  const [date, setDate] = useState(defaults.date);
  const [adults, setAdults] = useState(defaults.adults);
  const [children, setChildren] = useState(defaults.children);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string; token?: string } | null>(null);
  const pkg = packages.find((p) => p.id === pkgId);
  const price = useMemo(() => (pkg && date ? priceParty(pkg, date, { adults, children }) : null), [pkg, date, adults, children]);

  const create = () =>
    start(async () => {
      const r = await quoteAction(id, { packageId: pkgId, travelDate: date, adults, children, note });
      setResult(r.ok ? { ok: true, text: `Quote ${r.data!.ref} created`, token: r.data!.token } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <Card>
      <div id="quote" className="scroll-mt-24 border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-medium text-ink"><FileText size={17} className="text-muted" /> Quote</h2>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Package" htmlFor="q-pkg" className="sm:col-span-2">
            <select id="q-pkg" value={pkgId} onChange={(e) => setPkgId(e.target.value)} className={inputClass}>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}
            </select>
          </Field>
          <Field label="Start date" htmlFor="q-date"><input id="q-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adults" htmlFor="q-ad"><input id="q-ad" type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))} className={inputClass} /></Field>
            <Field label="Children" htmlFor="q-ch"><input id="q-ch" type="number" min={0} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))} className={inputClass} /></Field>
          </div>
        </div>
        <div className="rounded-lg bg-sand/70 p-3 text-sm" aria-live="polite">
          {!date ? <p className="text-muted">Choose a start date to price the quote.</p> : !price ? <p className="text-warn">This package has no price for that date. Choose another date or package.</p> : (
            <div className="tabular space-y-0.5">
              <p className="text-xs text-muted">{price.season.name} season · {price.season.hotelCategory}</p>
              {price.lines.map((l) => <p key={l.label} className="flex justify-between"><span>{l.label} {l.qty} × {formatINR(l.unit)}</span><span>{formatINR(l.amount)}</span></p>)}
              <p className="flex justify-between"><span>GST {price.gstPercent}%</span><span>{formatINR(price.gst)}</span></p>
              <p className="flex justify-between border-t border-line-strong pt-1 font-medium"><span>Total</span><span>{formatINR(price.total)}</span></p>
            </div>
          )}
        </div>
        <Field label="Note on the quote (optional)" htmlFor="q-note"><input id="q-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Includes airport pick-up. Rates held for 14 days." className={inputClass} /></Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={create} disabled={pending || !price}>{pending && <Spinner />} Create quote</Button>
          {result && <span role="status" className={cx("text-sm", result.ok ? "text-ok" : "text-danger")}>{result.text}</span>}
        </div>
        {quotes.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="tabular">{q.ref} · {q.code} · {q.travelDate}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular font-medium">{formatINR(q.total)}</span>
                  <Link href={`/q/${q.token}`} target="_blank" className="inline-flex items-center gap-1 text-accent hover:underline">Link <ExternalLink size={12} /></Link>
                  <a href={`/q/${q.token}/pdf`} target="_blank" className="text-accent hover:underline">PDF</a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
