import Image from "next/image";
import { Check, Minus, MapPin, Moon, Utensils, Hotel } from "lucide-react";
import type { PackageContent } from "@/lib/package-content";
import { formatINR, lowestPrice, seasonRangeLabel, seasonCoverage } from "@/lib/pricing";
import { PriceCalculator } from "./price-calculator";
import { RouteMap } from "./route-map";
import { EnquiryForm } from "./enquiry-form";

export function PriceBasis({ gst, className }: { gst: number; className?: string }) {
  return <span className={className}>per person, twin sharing, plus {gst}% GST</span>;
}

export function PackageView({ content: c, slug, code, preview = false }: { content: PackageContent; slug: string; code: string; preview?: boolean }) {
  const from = lowestPrice(c);
  const [cover, ...rest] = c.photos;
  const gaps = seasonCoverage(c.seasons).gaps;

  return (
    <article className="pb-20 lg:pb-0">
      {/* Full-bleed cover */}
      <div className="relative h-[52vh] min-h-[320px] w-full bg-sand sm:h-[64vh]">
        {cover && <Image src={cover.src} alt={cover.alt} fill priority sizes="100vw" className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="container-page absolute inset-x-0 bottom-0 pb-8 sm:pb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-white/80">{c.region} · {c.durationDays} days</p>
          <h1 className="mt-2 max-w-3xl font-display text-3xl leading-tight text-white sm:text-5xl">{c.title}</h1>
        </div>
      </div>

      <div className="container-page grid gap-12 pt-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <div className="min-w-0 space-y-14">
          {/* Summary and facts */}
          <section className="space-y-6">
            <p className="max-w-2xl font-display text-xl leading-relaxed text-ink-2 sm:text-2xl">{c.summary}</p>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-4">
              {[
                ["Length", `${c.durationDays} days, ${c.durationDays - 1} nights`],
                ["Route", c.destinations.join(" → ")],
                ["Hotels", [...new Set(c.hotels.map((h) => h.category))].join(", ") || "—"],
                ["From", from ? formatINR(from) : "On request"],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface p-4">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="tabular mt-1 text-sm font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {c.highlights.length > 0 && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {c.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-[15px] text-ink-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {rest.length > 0 && (
            <section aria-label="Photos" className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
              {rest.map((p) => (
                <figure key={p.src} className="relative aspect-[4/3] w-[75%] shrink-0 snap-start overflow-hidden rounded-xl bg-sand sm:w-auto">
                  <Image src={p.src} alt={p.alt} fill sizes="(min-width: 640px) 260px, 75vw" className="object-cover" />
                </figure>
              ))}
            </section>
          )}

          {/* Itinerary */}
          <section aria-labelledby="itinerary">
            <h2 id="itinerary" className="font-display text-2xl text-ink">Day by day</h2>
            <ol className="mt-6">
              {c.itinerary.map((d, i) => (
                <li key={d.day} className="relative grid grid-cols-[40px_1fr] gap-4 pb-8 last:pb-0">
                  {i < c.itinerary.length - 1 && <span className="absolute left-[19px] top-10 bottom-0 w-px bg-line" aria-hidden />}
                  <span className="tabular flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-medium text-ink">{d.day}</span>
                  <div className="pt-1.5">
                    <h3 className="font-medium text-ink">{d.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{d.description}</p>
                    {(d.overnight || d.meals) && (
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        {d.overnight && <span className="inline-flex items-center gap-1"><Moon size={12} /> {d.overnight}</span>}
                        {d.meals && <span className="inline-flex items-center gap-1"><Utensils size={12} /> {d.meals}</span>}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Inclusions */}
          <section className="grid gap-10 sm:grid-cols-2">
            <div>
              <h2 className="font-display text-xl text-ink">Included</h2>
              <ul className="mt-4 space-y-2.5">
                {c.inclusions.map((x) => (
                  <li key={x} className="flex gap-2.5 text-[15px] text-ink-2"><Check size={18} className="mt-0.5 shrink-0 text-ok" />{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-display text-xl text-ink">Not included</h2>
              <ul className="mt-4 space-y-2.5">
                {c.exclusions.map((x) => (
                  <li key={x} className="flex gap-2.5 text-[15px] text-muted"><Minus size={18} className="mt-0.5 shrink-0" />{x}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* Hotels */}
          {c.hotels.length > 0 && (
            <section>
              <h2 className="font-display text-xl text-ink">Where you stay</h2>
              <ul className="mt-4 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
                {c.hotels.map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Hotel size={18} className="text-faint" />
                      <div>
                        <p className="text-sm font-medium text-ink">{h.location}</p>
                        <p className="text-xs text-muted">{h.name || "Selected at booking"}</p>
                      </div>
                    </div>
                    <p className="tabular text-right text-sm text-ink-2">{h.category}<span className="block text-xs text-muted">{h.nights} night{h.nights > 1 ? "s" : ""}</span></p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Seasonal prices */}
          <section aria-labelledby="prices">
            <h2 id="prices" className="font-display text-xl text-ink">Prices by season</h2>
            <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              <table className="w-full text-sm">
                <thead className="bg-sand/60 text-left text-xs text-muted">
                  <tr><th className="px-4 py-2.5 font-medium">Season</th><th className="px-4 py-2.5 font-medium">Dates</th><th className="hidden px-4 py-2.5 font-medium sm:table-cell">Hotels</th><th className="px-4 py-2.5 text-right font-medium">Per person</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {c.seasons.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                      <td className="px-4 py-3 text-ink-2">{seasonRangeLabel(s)}</td>
                      <td className="hidden px-4 py-3 text-ink-2 sm:table-cell">{s.hotelCategory}</td>
                      <td className="tabular px-4 py-3 text-right font-medium text-ink">{formatINR(s.pricePerPerson)}</td>
                    </tr>
                  ))}
                  {gaps.map((g) => (
                    <tr key={g}><td className="px-4 py-3 text-muted">Other dates</td><td className="px-4 py-3 text-muted">{g}</td><td className="hidden sm:table-cell" /><td className="px-4 py-3 text-right text-muted">On request</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Prices are <PriceBasis gst={c.gstPercent} />. Children aged 5–11 sharing their parents&apos; room pay {c.childPercent}% of the adult price; under-5s travel free. The season is set by your start date.
            </p>
          </section>

          {/* Map */}
          {c.mapStops.length > 0 && (
            <section aria-labelledby="route">
              <h2 id="route" className="font-display text-xl text-ink">The route</h2>
              <p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted"><MapPin size={14} /> {c.mapStops.map((s) => s.name).join(" → ")}</p>
              <RouteMap stops={c.mapStops} />
            </section>
          )}

          {/* Enquiry */}
          <section id="enquire" className="scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-8">
            <h2 className="font-display text-2xl text-ink">Enquire about this trip</h2>
            <p className="mt-1 text-sm text-muted">A consultant replies within one working hour with availability and an exact price. No payment needed.</p>
            <div className="mt-6">
              <EnquiryForm packageSlug={slug} packageTitle={c.title} disabled={preview} />
            </div>
          </section>
        </div>

        {/* Sticky price card (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
              <p className="text-xs text-muted">From</p>
              <p className="tabular font-display text-3xl text-ink">{from ? formatINR(from) : "On request"}</p>
              <p className="mt-0.5 text-xs text-muted"><PriceBasis gst={c.gstPercent} /></p>
              <div className="mt-5 border-t border-line pt-5">
                <PriceCalculator seasons={c.seasons} childPercent={c.childPercent} gstPercent={c.gstPercent} />
              </div>
              <a href="#enquire" className="mt-5 flex h-12 w-full items-center justify-center rounded-lg bg-accent text-base font-medium text-white transition-colors hover:bg-accent-hover">Enquire</a>
            </div>
            <p className="px-1 text-xs text-muted">Ref {code}. Fully private: your own car, driver and guide.</p>
          </div>
        </aside>
      </div>

      {/* Sticky enquire bar (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur lg:hidden">
        <div className="container-page flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="tabular truncate text-base font-medium text-ink">{from ? `From ${formatINR(from)}` : "Price on request"}</p>
            <p className="truncate text-xs text-muted"><PriceBasis gst={c.gstPercent} /></p>
          </div>
          <a href="#enquire" className="flex h-11 shrink-0 items-center rounded-lg bg-accent px-6 font-medium text-white">Enquire</a>
        </div>
      </div>
    </article>
  );
}
