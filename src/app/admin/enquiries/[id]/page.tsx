import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, Phone, ShieldCheck, ShieldOff } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getEnquiryDetail } from "@/server/enquiries";
import { can } from "@/lib/permissions";
import { Badge } from "@/components/ui";
import { ChannelIcon, PageBody, PageHeader, SlaBadge } from "@/components/admin/bits";
import { HeaderControls } from "./header-controls";
import { ExtractionPanel } from "./extraction-panel";
import { WorkPanel } from "./work-panel";
import { Timeline } from "./timeline";

export const metadata: Metadata = { title: "Enquiry" };
export const dynamic = "force-dynamic";

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("enquiries.view", `/admin/enquiries/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await getEnquiryDetail(id, user);
  if (!d) notFound();
  const e = d.enquiry;
  const closed = ["booked", "lost", "spam"].includes(e.status);

  return (
    <>
      <PageHeader
        back={<Link href="/admin/enquiries" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Inbox</Link>}
        title={e.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="tabular">{e.ref}</span>
            <ChannelIcon channel={e.channel} withLabel />
            {e.email && <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1 hover:text-ink"><Mail size={13} /> {e.email}</a>}
            {e.phone && <span className="inline-flex items-center gap-1"><Phone size={13} /> {e.phone}</span>}
            {e.consentWhatsapp ? <Badge tone="ok"><ShieldCheck size={12} /> WhatsApp consent</Badge> : <Badge tone="neutral"><ShieldOff size={12} /> No WhatsApp consent</Badge>}
            <SlaBadge createdAt={e.createdAt} firstReplyAt={e.firstReplyAt} closed={closed} />
          </span>
        }
        actions={<HeaderControls id={e.id} status={e.status} assignedToId={e.assignedToId} staff={d.staff} canAssign={can(user.role, "enquiries.assign")} meId={user.id} />}
      />
      <PageBody className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <ExtractionPanel
            key={e.confirmedAt?.toISOString() ?? "unconfirmed"}
            id={e.id}
            message={e.message}
            fields={d.fields}
            engine={d.extraction?.engine ?? "rules"}
            warnings={d.extraction?.warnings ?? []}
            questions={d.extraction?.questions ?? []}
            confirmedAt={e.confirmedAt?.toISOString() ?? null}
            createdAt={e.createdAt.toISOString()}
            requestedPackage={d.requestedPackage}
            form={{ date: e.formDate, adults: e.formAdults, children: e.formChildren }}
          />
          <Timeline id={e.id} events={d.events.map((x) => ({ id: x.id, type: x.type, body: x.body, actor: x.actor, at: x.createdAt.toISOString() }))} messages={d.messages.map((m) => ({ id: m.id, kind: m.kind, channel: m.channel, to: m.to, subject: m.subject, body: m.body, at: m.createdAt.toISOString() }))} />
        </div>
        <div className="min-w-0">
          <WorkPanel
            id={e.id}
            suggestions={d.suggestions}
            draft={d.draft}
            hasEmail={!!e.email}
            hasPhone={!!e.phone}
            whatsappConsent={e.consentWhatsapp}
            livePackages={d.livePackages}
            quotes={d.quotes.map((q) => ({ id: q.id, ref: q.ref, token: q.token, code: q.code, total: q.price.total, travelDate: q.travelDate, at: q.createdAt.toISOString() }))}
            defaults={{
              adults: d.fields.adults?.value ?? 2,
              children: d.fields.children?.value ?? 0,
              date: d.fields.travelDates?.value.start ?? (d.fields.travelDates?.value.month ? `${d.fields.travelDates.value.month}-15` : ""),
            }}
            canQuote={can(user.role, "quotes.create")}
          />
        </div>
      </PageBody>
    </>
  );
}
