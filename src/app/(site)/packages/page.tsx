import type { Metadata } from "next";
import Link from "next/link";
import { getLivePackages } from "@/server/packages";
import { searchPackages, type SearchParams } from "@/lib/search";
import { PackageCard } from "@/components/site/package-card";
import { REGIONS, THEMES } from "@/lib/package-content";
import { EmptyState, buttonClass, inputClass, cx } from "@/components/ui";

export const metadata: Metadata = {
  title: "All packages",
  description: "Private Kerala and South India holiday packages: houseboats, hill stations, beaches, wildlife and temple towns. Prices per person, twin sharing.",
  alternates: { canonical: "/packages" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function PackagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const params: SearchParams = { q: sp.q?.slice(0, 80), region: sp.region, theme: sp.theme, length: (sp.length as SearchParams["length"]) ?? "", month: sp.month };
  const live = await getLivePackages();
  const results = searchPackages(live, params);
  const filtered = Object.values(params).some(Boolean);

  return (
    <div className="container-page pt-10 sm:pt-14">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">Holidays in South India</h1>
      <p className="mt-3 max-w-xl text-muted">Every package is private and can be adjusted. Prices are per person on twin sharing, plus 5% GST.</p>

      <form className="mt-8 grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" role="search">
        <label className="sr-only" htmlFor="q">Search</label>
        <input id="q" name="q" defaultValue={params.q} placeholder="Search places or experiences" className={inputClass} />
        <select name="region" defaultValue={params.region ?? ""} aria-label="Region" className={inputClass}>
          <option value="">All regions</option>
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select name="theme" defaultValue={params.theme ?? ""} aria-label="Experience" className={cx(inputClass, "capitalize")}>
          <option value="">Any experience</option>
          {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="length" defaultValue={params.length ?? ""} aria-label="Length" className={inputClass}>
          <option value="">Any length</option>
          <option value="short">Up to 4 days</option>
          <option value="medium">5–7 days</option>
          <option value="long">8 days or more</option>
        </select>
        <select name="month" defaultValue={params.month ?? ""} aria-label="Month" className={inputClass}>
          <option value="">Any month</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <button className={buttonClass("primary", "md", "h-[42px]")}>Search</button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm text-muted">
        <p aria-live="polite">{results.length} {results.length === 1 ? "trip" : "trips"}{filtered ? " match" : ""}</p>
        {filtered && <Link href="/packages" className="text-accent hover:underline">Clear filters</Link>}
      </div>

      {results.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line-strong">
          <EmptyState
            title="No package matches that yet"
            body="We plan custom trips every day. Tell us what you have in mind and a consultant will design one."
            action={<Link href="/enquire" className={buttonClass("primary")}>Ask for a custom trip</Link>}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p, i) => <PackageCard key={p.id} slug={p.slug} content={p.content} priority={i < 3} />)}
        </div>
      )}
    </div>
  );
}
