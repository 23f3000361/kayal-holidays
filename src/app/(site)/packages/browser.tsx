"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { searchPackages, type SearchParams } from "@/lib/search";
import { PackageCard } from "@/components/site/package-card";
import { REGIONS, THEMES, type PackageContent } from "@/lib/package-content";
import { EmptyState, buttonClass, inputClass, cx } from "@/components/ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export type BrowserItem = { id: string; slug: string; content: PackageContent };

/** Filters in the browser so the page itself can be static and cached (fast on 4G). */
export function PackageBrowser({ items }: { items: BrowserItem[] }) {
  const sp = useSearchParams();
  const params: SearchParams = {
    q: sp.get("q")?.slice(0, 80) ?? "",
    region: sp.get("region") ?? "",
    theme: sp.get("theme") ?? "",
    length: (sp.get("length") as SearchParams["length"]) ?? "",
    month: sp.get("month") ?? "",
  };
  return <PackageResults items={items} params={params} />;
}

/** Pure view of the list for given filters; also the server-rendered fallback (no filters). */
export function PackageResults({ items, params: p }: { items: BrowserItem[]; params: SearchParams }) {
  const router = useRouter();
  const results = searchPackages(items, p);
  const filtered = Object.values(p).some(Boolean);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const qs = new URLSearchParams([...data.entries()].filter(([, v]) => v) as [string, string][]);
    router.replace(qs.size ? `/packages?${qs}` : "/packages", { scroll: false });
  };

  return (
    <>
      <form key={JSON.stringify(p)} onSubmit={submit} className="mt-8 grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" role="search">
        <label className="sr-only" htmlFor="q">Search</label>
        <input id="q" name="q" defaultValue={p.q} placeholder="Search places or experiences" className={inputClass} />
        <select name="region" defaultValue={p.region} aria-label="Region" className={inputClass}>
          <option value="">All regions</option>
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select name="theme" defaultValue={p.theme} aria-label="Experience" className={cx(inputClass, "capitalize")}>
          <option value="">Any experience</option>
          {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="length" defaultValue={p.length} aria-label="Length" className={inputClass}>
          <option value="">Any length</option>
          <option value="short">Up to 4 days</option>
          <option value="medium">5–7 days</option>
          <option value="long">8 days or more</option>
        </select>
        <select name="month" defaultValue={p.month} aria-label="Month" className={inputClass}>
          <option value="">Any month</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <button className={buttonClass("primary", "md", "h-[42px]")}>Search</button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm text-muted">
        <p aria-live="polite">{results.length} {results.length === 1 ? "trip" : "trips"}{filtered ? " match" : ""}</p>
        {filtered && <Link href="/packages" scroll={false} className="text-accent hover:underline">Clear filters</Link>}
      </div>

      {results.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line-strong">
          <EmptyState title="No package matches that yet" body="We plan custom trips every day. Tell us what you have in mind and a consultant will design one." action={<Link href="/enquire" className={buttonClass("primary")}>Ask for a custom trip</Link>} />
        </div>
      ) : (
        <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((x, i) => <PackageCard key={x.id} slug={x.slug} content={x.content} priority={i === 0} />)}
        </div>
      )}
    </>
  );
}
