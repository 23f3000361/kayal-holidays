import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { dueAt, isWorkingTime } from "@/lib/sla";

export const metadata: Metadata = { title: "Enquiry received", robots: { index: false } };

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const safeRef = ref && /^ENQ-\d+$/.test(ref) ? ref : null;
  const now = new Date();
  const due = dueAt(now);
  const when = due.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", hour: "numeric", minute: "2-digit" });

  return (
    <div className="container-page flex max-w-xl flex-col items-center pt-20 text-center">
      <CheckCircle2 size={44} className="text-ok" strokeWidth={1.5} />
      <h1 className="mt-5 font-display text-4xl text-ink">Thank you. We have it.</h1>
      {safeRef && <p className="tabular mt-3 text-sm text-muted">Your reference is <span className="font-medium text-ink">{safeRef}</span></p>}
      <p className="mt-6 text-lg leading-relaxed text-ink-2">
        We have sent a confirmation to your email. A consultant will reply {isWorkingTime(now) ? "within the hour" : `by ${when} IST`} with trips that fit and exact prices.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/packages" className={buttonClass("secondary")}>Keep browsing</Link>
        <Link href="/" className={buttonClass("ghost")}>Home</Link>
      </div>
    </div>
  );
}
