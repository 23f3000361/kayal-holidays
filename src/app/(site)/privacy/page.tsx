import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice", alternates: { canonical: "/privacy" } };

const SECTIONS: [string, string][] = [
  ["What we collect", "Your name, email, phone number (optional), travel dates, party size and what you write in your enquiry."],
  ["Why", "Only to reply to your enquiry, prepare a quote and, if you book, arrange your trip. This is the purpose you consent to when you send the form, as required by the Digital Personal Data Protection Act, 2023."],
  ["WhatsApp", "We contact you on WhatsApp only if you tick the WhatsApp box. Our staff cannot send a WhatsApp reply without that consent on record."],
  ["Who sees it", "Only the consultant handling your enquiry and our administrators. Content editors who update the website cannot see enquiries."],
  ["How long", "Enquiries that do not lead to a booking are deleted after 12 months (assumed retention period, to be confirmed by the client)."],
  ["Your rights", "You can ask to see, correct or delete your data, or withdraw consent, by writing to the grievance officer at privacy@example.com."],
];

export default function PrivacyPage() {
  return (
    <div className="container-page max-w-2xl pt-14">
      <h1 className="font-display text-4xl text-ink">Privacy notice</h1>
      <p className="mt-3 text-muted">A short, plain summary of how Kayal Holidays handles the details you send us.</p>
      <dl className="mt-10 space-y-8">
        {SECTIONS.map(([t, d]) => (
          <div key={t}>
            <dt className="font-medium text-ink">{t}</dt>
            <dd className="mt-1.5 leading-relaxed text-ink-2">{d}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
