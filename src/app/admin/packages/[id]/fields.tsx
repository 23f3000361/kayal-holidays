"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Season } from "@/lib/package-content";
import { HOTEL_CATEGORIES } from "@/lib/package-content";
import { formatINR, seasonCoverage } from "@/lib/pricing";
import { Alert, inputClass, cx } from "@/components/ui";

export function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-medium text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  );
}

export function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cx("tabular text-xs", value.length > max ? "text-danger" : "text-faint")}>{value.length}/{max}</span>;
}

const IconBtn = ({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="rounded-md p-1.5 text-muted hover:bg-sand hover:text-ink disabled:opacity-30">{children}</button>
);

export function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Editable list of short lines (highlights, inclusions…). */
export function LinesEditor({ value, onChange, placeholder, max = 25 }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {value.map((line, i) => (
        <div key={i} className="flex items-center gap-1">
          <input value={line} aria-label={`Line ${i + 1}`} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} className={inputClass} />
          <IconBtn label="Move up" onClick={() => onChange(move(value, i, -1))} disabled={i === 0}><ArrowUp size={15} /></IconBtn>
          <IconBtn label="Move down" onClick={() => onChange(move(value, i, 1))} disabled={i === value.length - 1}><ArrowDown size={15} /></IconBtn>
          <IconBtn label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 size={15} /></IconBtn>
        </div>
      ))}
      {value.length < max && (
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} className={inputClass} />
          <button type="button" onClick={add} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-strong px-3 text-sm text-ink-2 hover:bg-paper"><Plus size={14} /> Add</button>
        </div>
      )}
    </div>
  );
}

/** Tag input for destinations. */
export function TagsEditor({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState("");
  const add = (t: string) => {
    const v = t.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="rounded-lg border border-line-strong bg-surface p-2 focus-within:border-accent">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t, i) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-sand px-2 py-1 text-sm text-ink-2">
            {i > 0 && <span className="text-faint">→</span>}{t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="text-faint hover:text-ink"><X size={13} /></button>
          </span>
        ))}
        <input
          list="place-suggestions"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); } if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1)); }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "Add another" : "Type a place and press Enter"}
          aria-label="Add destination"
          className="min-w-[160px] flex-1 bg-transparent px-1 py-1 text-[15px] focus:outline-none"
        />
        <datalist id="place-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function MonthDay({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [m, d] = value.split("-").map(Number);
  const set = (mm: number, dd: number) => onChange(`${String(mm).padStart(2, "0")}-${String(Math.min(dd, DAYS_IN[mm - 1])).padStart(2, "0")}`);
  return (
    <div className="flex gap-1" role="group" aria-label={label}>
      <select aria-label={`${label} day`} value={d} onChange={(e) => set(m, Number(e.target.value))} className={cx(inputClass, "w-[68px] px-2")}>
        {Array.from({ length: DAYS_IN[m - 1] }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select>
      <select aria-label={`${label} month`} value={m} onChange={(e) => set(Number(e.target.value), d)} className={cx(inputClass, "w-[78px] px-2")}>
        {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
    </div>
  );
}

export function SeasonsEditor({ value, onChange, errors }: { value: Season[]; onChange: (v: Season[]) => void; errors: Record<string, string> }) {
  const { gaps, overlaps } = seasonCoverage(value);
  const update = (i: number, patch: Partial<Season>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const add = () => onChange([...value, { id: crypto.randomUUID().slice(0, 8), name: value.length ? "New season" : "All year", from: value.length ? "04-01" : "01-01", to: value.length ? "05-31" : "12-31", pricePerPerson: value[0]?.pricePerPerson ?? 20000, hotelCategory: value[0]?.hotelCategory ?? "4 star" }]);

  return (
    <div className="space-y-3">
      {value.map((s, i) => (
        <div key={s.id} className="space-y-3 rounded-lg border border-line p-3">
          <div className="flex items-start gap-3">
            <label className="min-w-0 flex-1 space-y-1">
              <span className="text-xs text-muted">Season name</span>
              <input value={s.name} onChange={(e) => update(i, { name: e.target.value })} className={inputClass} />
            </label>
            <label className="w-40 space-y-1">
              <span className="text-xs text-muted">Price per person (₹)</span>
              <input type="number" inputMode="numeric" min={0} step={100} aria-label={`${s.name} price per person in rupees`} value={s.pricePerPerson} onChange={(e) => update(i, { pricePerPerson: Math.round(Number(e.target.value)) })} aria-invalid={!!errors[`seasons.${i}.pricePerPerson`] || undefined} className={cx(inputClass, "tabular text-right font-medium")} />
            </label>
            <button type="button" aria-label={`Remove ${s.name}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="mt-6 rounded-md p-1.5 text-muted hover:bg-sand hover:text-danger"><Trash2 size={16} /></button>
          </div>
          {errors[`seasons.${i}.pricePerPerson`] && <p className="text-xs text-danger">{errors[`seasons.${i}.pricePerPerson`]}</p>}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><span className="block text-xs text-muted">From</span><MonthDay label="From" value={s.from} onChange={(v) => update(i, { from: v })} /></div>
            <div className="space-y-1"><span className="block text-xs text-muted">To (inclusive)</span><MonthDay label="To" value={s.to} onChange={(v) => update(i, { to: v })} /></div>
            <label className="min-w-[130px] flex-1 space-y-1">
              <span className="text-xs text-muted">Hotels</span>
              <select value={s.hotelCategory} onChange={(e) => update(i, { hotelCategory: e.target.value })} className={inputClass}>
                {HOTEL_CATEGORIES.map((h) => <option key={h}>{h}</option>)}
              </select>
            </label>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm text-ink-2 hover:border-accent hover:text-accent"><Plus size={14} /> Add a season</button>
      {overlaps.length > 0 && <Alert tone="danger" title="Seasons overlap">On {overlaps.join(", ")} two prices apply. Adjust the dates so each day has one price.</Alert>}
      {gaps.length > 0 && value.length > 0 && <Alert tone="warn" title="Some dates have no price">{gaps.join(", ")} will show &ldquo;price on request&rdquo; on the website and in quotes.</Alert>}
      {value.length > 0 && (
        <p className="text-xs text-muted">The website shows: {value.map((s) => `${s.name} ${formatINR(s.pricePerPerson)}`).join(" · ")}, per person, twin sharing, plus GST.</p>
      )}
    </div>
  );
}
