import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { getLivePackages } from "@/server/packages";
import { PackageCard } from "@/components/site/package-card";
import { REGION_INFO } from "@/lib/regions";
import { THEMES } from "@/lib/package-content";

export const revalidate = 60;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function HomePage() {
  const live = await getLivePackages();
  const featured = ["munnar-thekkady-alleppey-houseboat", "kerala-honeymoon-munnar-thekkady-kumarakom", "kovalam-varkala-beaches-ayurveda"]
    .map((slug) => live.find((p) => p.slug === slug))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const more = live.filter((p) => !featured.includes(p)).slice(0, 3);
  const regions = (Object.keys(REGION_INFO) as (keyof typeof REGION_INFO)[]).map((r) => ({ name: r, ...REGION_INFO[r], count: live.filter((p) => p.content.region === r).length })).filter((r) => r.count > 0);

  return (
    <>
      <section className="relative flex min-h-[92svh] items-end overflow-hidden bg-ink">
        <Image src="/photos/alleppey-houseboat.jpg" alt="A houseboat on the backwaters of Alleppey, Kerala" fill priority sizes="100vw" className="object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
        <div className="container-page relative pb-14 pt-32 sm:pb-20">
          <p className="text-xs uppercase tracking-[0.2em] text-white/80">Kerala & South India, privately</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] text-white sm:text-7xl">
            Travel slowly.<br />Come home changed.
          </h1>
          <form action="/packages" className="mt-10 grid max-w-3xl gap-2 rounded-2xl bg-white/95 p-2 shadow-[var(--shadow-lift)] backdrop-blur sm:grid-cols-[1fr_180px_auto]" role="search">
            <label className="flex items-center gap-2 px-3">
              <Search size={18} className="shrink-0 text-faint" />
              <span className="sr-only">Where or what</span>
              <input name="q" placeholder="Houseboat, Munnar, beaches…" className="h-12 w-full bg-transparent text-[15px] text-ink placeholder:text-faint focus:outline-none" />
            </label>
            <label className="border-line px-3 sm:border-l">
              <span className="sr-only">Month</span>
              <select name="month" defaultValue="" className="h-12 w-full bg-transparent text-[15px] text-ink focus:outline-none">
                <option value="">Any month</option>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <button className="h-12 rounded-xl bg-accent px-6 font-medium text-white transition-colors hover:bg-accent-hover">Find trips</button>
          </form>
        </div>
      </section>

      <section className="container-page pt-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">Journeys travellers love</h2>
            <p className="mt-2 text-muted">Every trip is private: your own car, driver and pace.</p>
          </div>
          <Link href="/packages" className="hidden items-center gap-1 text-sm text-accent hover:underline sm:flex">All {live.length} packages <ArrowRight size={14} /></Link>
        </div>
        <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p, i) => <PackageCard key={p.id} slug={p.slug} content={p.content} priority={i === 0} />)}
        </div>
      </section>

      <section className="container-page pt-24">
        <h2 className="font-display text-3xl text-ink sm:text-4xl">Where we go</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {regions.map((r) => (
            <Link key={r.slug} href={`/destinations/${r.slug}`} className="group relative block aspect-[3/4] overflow-hidden rounded-[var(--radius-card)] bg-sand">
              <Image src={r.photo} alt={r.name} fill sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="font-display text-2xl text-white">{r.name}</p>
                <p className="mt-1 text-sm text-white/80">{r.blurb}</p>
                <p className="mt-2 text-xs text-white/70">{r.count} package{r.count > 1 ? "s" : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page pt-24">
        <div className="grid gap-10 rounded-[var(--radius-card)] bg-sand/70 p-8 sm:p-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-display text-3xl text-ink">Tell us roughly. We&apos;ll do the rest.</h2>
            <p className="mt-3 text-muted">Write your enquiry the way you would to a friend. A consultant in Kochi reads it, picks the best trips and replies within one working hour.</p>
          </div>
          <ol className="grid gap-6 sm:grid-cols-3">
            {[
              ["Write to us", "Dates, who's coming, a rough budget. Any format."],
              ["Get options", "Three trips that fit, with exact prices for your dates."],
              ["Travel", "Confirm, and we look after every transfer and stay."],
            ].map(([t, d], i) => (
              <li key={t}>
                <span className="tabular font-display text-3xl text-gold">0{i + 1}</span>
                <p className="mt-2 font-medium text-ink">{t}</p>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {more.length > 0 && (
        <section className="container-page pt-24">
          <h2 className="font-display text-3xl text-ink sm:text-4xl">More ideas</h2>
          <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => <PackageCard key={p.id} slug={p.slug} content={p.content} />)}
          </div>
          <div className="mt-12 flex flex-wrap gap-2">
            {THEMES.filter((t) => live.some((p) => p.content.themes.includes(t))).map((t) => (
              <Link key={t} href={`/packages?theme=${encodeURIComponent(t)}`} className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm capitalize text-ink-2 transition-colors hover:border-accent hover:text-accent">{t}</Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
