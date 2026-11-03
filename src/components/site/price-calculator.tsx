"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Season } from "@/lib/package-content";
import { formatINR, priceParty } from "@/lib/pricing";

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-2">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="flex size-8 items-center justify-center rounded-full border border-line-strong text-ink-2 disabled:opacity-30">
          <Minus size={14} />
        </button>
        <span className="tabular w-4 text-center text-sm font-medium" aria-live="polite">{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="flex size-8 items-center justify-center rounded-full border border-line-strong text-ink-2 disabled:opacity-30">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

/** Same pricing function as the server and the reply drafts, so the numbers always agree. */
export function PriceCalculator({ seasons, childPercent, gstPercent }: { seasons: Season[]; childPercent: number; gstPercent: number }) {
  const [date, setDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const price = useMemo(() => (date ? priceParty({ seasons, childPercent, gstPercent }, date, { adults, children }) : null), [date, adults, children, seasons, childPercent, gstPercent]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm text-ink-2">Start date</span>
        <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none" />
      </label>
      <Stepper label="Adults" value={adults} min={1} max={12} onChange={setAdults} />
      <Stepper label="Children 5–11" value={children} min={0} max={8} onChange={setChildren} />
      <div className="rounded-lg bg-sand/70 p-3 text-sm" aria-live="polite">
        {!date ? (
          <p className="text-muted">Pick a date to see your price.</p>
        ) : !price ? (
          <p className="text-muted">No fixed price for that date yet. Enquire and we will quote it.</p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted">{price.season.name} season</p>
            {price.lines.map((l) => (
              <p key={l.label} className="tabular flex justify-between text-ink-2"><span>{l.qty} × {formatINR(l.unit)}</span><span>{formatINR(l.amount)}</span></p>
            ))}
            <p className="tabular flex justify-between text-ink-2"><span>GST {price.gstPercent}%</span><span>{formatINR(price.gst)}</span></p>
            <p className="tabular flex justify-between border-t border-line-strong pt-1 font-medium text-ink"><span>Total</span><span>{formatINR(price.total)}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
