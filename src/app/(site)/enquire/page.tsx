import type { Metadata } from "next";
import { EnquiryForm } from "@/components/site/enquiry-form";

export const metadata: Metadata = { title: "Plan a trip", description: "Tell us about the holiday you have in mind. A consultant in Kochi replies within one working hour.", alternates: { canonical: "/enquire" } };

export default function EnquirePage() {
  return (
    <div className="container-page grid gap-12 pt-12 lg:grid-cols-[1fr_1.3fr] lg:pt-20">
      <div>
        <h1 className="font-display text-4xl text-ink sm:text-5xl">Plan a trip with us</h1>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">Write as much or as little as you like. We read every enquiry, suggest the trips that fit and send exact prices.</p>
        <dl className="mt-10 space-y-5 text-sm">
          <div><dt className="font-medium text-ink">Reply time</dt><dd className="mt-1 text-muted">Within one working hour, Monday to Saturday, 9 am to 7 pm IST. Later enquiries are answered first thing next morning.</dd></div>
          <div><dt className="font-medium text-ink">No payment now</dt><dd className="mt-1 text-muted">You only pay once you have chosen a trip and confirmed the dates.</dd></div>
          <div><dt className="font-medium text-ink">Your details</dt><dd className="mt-1 text-muted">Used only to answer this enquiry. We message you on WhatsApp only if you say so.</dd></div>
        </dl>
      </div>
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-8">
        <EnquiryForm />
      </div>
    </div>
  );
}
