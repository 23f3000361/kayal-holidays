import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getQuoteByToken } from "@/server/enquiries";
import { formatINR } from "@/lib/pricing";
import { Logo } from "@/components/site/header";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Your quote", robots: { index: false, follow: false } };

const d = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,64}$/.test(token)) notFound();
  const row = await getQuoteByToken(token);
  if (!row) notFound();
  const { q, e, v, by } = row;
  const c = v.content;
  const expired = q.validUntil < new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-dvh bg-paper pb-20">
      <header className="container-page flex h-16 items-center justify-between">
        <Logo />
        <a href={`/q/${token}/pdf`} className={buttonClass("secondary", "sm")}><Download size={14} /> PDF</a>
      </header>
      <div className="container-page max-w-3xl">
        <div className="relative mt-4 aspect-[21/9] overflow-hidden rounded-[var(--radius-card)] bg-sand">
          {c.photos[0] && <Image src={c.photos[0].src} alt={c.photos[0].alt} fill priority sizes="768px" className="object-cover" />}
        </div>
        <p className="tabular mt-8 text-sm text-muted">Quote {q.ref} for {e.name} · valid until {d(q.validUntil)}</p>
        {expired && <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">This quote has expired. Reply to your consultant for updated prices.</p>}
        <h1 className="mt-2 font-display text-4xl text-ink">{c.title}</h1>
        <p className="mt-3 text-lg text-ink-2">{c.summary}</p>

        <dl className="mt-8 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">Start date</dt><dd className="mt-1 font-medium">{d(q.travelDate)}</dd></div>
          <div><dt className="text-muted">Length</dt><dd className="mt-1 font-medium">{c.durationDays} days</dd></div>
          <div><dt className="text-muted">Travellers</dt><dd className="mt-1 font-medium">{q.adults} adult{q.adults > 1 ? "s" : ""}{q.children ? `, ${q.children} child${q.children > 1 ? "ren" : ""}` : ""}</dd></div>
          <div><dt className="text-muted">Season</dt><dd className="mt-1 font-medium">{q.price.season.name}, {q.price.season.hotelCategory}</dd></div>
        </dl>

        <table className="tabular mt-8 w-full text-sm">
          <tbody className="divide-y divide-line border-y border-line">
            {q.price.lines.map((l) => (
              <tr key={l.label}><td className="py-3 text-ink-2">{l.label}</td><td className="py-3 text-right text-muted">{l.qty} × {formatINR(l.unit)}</td><td className="py-3 text-right">{formatINR(l.amount)}</td></tr>
            ))}
            <tr><td className="py-3 text-ink-2">GST</td><td className="py-3 text-right text-muted">{q.price.gstPercent}%</td><td className="py-3 text-right">{formatINR(q.price.gst)}</td></tr>
            <tr><td className="py-4 font-medium text-ink" colSpan={2}>Total</td><td className="py-4 text-right font-display text-2xl text-ink">{formatINR(q.price.total)}</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">Prices are per person on twin sharing as shown, from the package price table on the date of this quote. Subject to hotel availability when you book.</p>
        {q.note && <p className="mt-6 rounded-lg bg-sand/70 p-4 text-sm text-ink-2">{q.note}</p>}

        <h2 className="mt-12 font-display text-2xl">Day by day</h2>
        <ol className="mt-4 space-y-4">
          {c.itinerary.map((day) => (
            <li key={day.day} className="grid grid-cols-[56px_1fr] gap-3 text-sm">
              <span className="tabular text-muted">Day {day.day}</span>
              <div><p className="font-medium text-ink">{day.title}</p><p className="mt-0.5 text-ink-2">{day.description}</p></div>
            </li>
          ))}
        </ol>
        <div className="mt-12 rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <p className="font-medium text-ink">Ready to go ahead?</p>
          <p className="mt-1 text-sm text-muted">Reply to {by ?? "your consultant"} with your preferred dates and we will hold the hotels. Online payment is not part of this demo.</p>
          <Link href={`/packages/${row.p.slug}`} className="mt-4 inline-block text-sm text-accent hover:underline">See the package page</Link>
        </div>
      </div>
    </main>
  );
}
