import type { Metadata } from "next";
import Link from "next/link";
import { FileText, MessageSquare } from "lucide-react";
import { requireUser } from "@/server/auth";
import { travellerEnquiries } from "@/server/enquiries";
import { logout } from "@/app/login/actions";
import { Badge, ButtonLink, Card, EmptyState, buttonClass } from "@/components/ui";
import { formatINR } from "@/lib/pricing";

export const metadata: Metadata = { title: "Your trips", robots: { index: false } };

const STATUS: Record<string, { label: string; tone: "accent" | "ok" | "neutral" | "warn" }> = {
  new: { label: "Received", tone: "neutral" },
  replied: { label: "Replied", tone: "accent" },
  quoted: { label: "Quote sent", tone: "accent" },
  booked: { label: "Booked", tone: "ok" },
  lost: { label: "Closed", tone: "neutral" },
  spam: { label: "Closed", tone: "neutral" },
};

const fmt = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function AccountPage() {
  const user = await requireUser(undefined, "/account");
  if (user.role !== "traveller") return <div className="container-page pt-16"><EmptyState title="This page is for travellers" body="You are signed in as staff." action={<ButtonLink href="/admin">Go to the dashboard</ButtonLink>} /></div>;
  const items = await travellerEnquiries(user.id);

  return (
    <div className="container-page max-w-3xl pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink">Your trips</h1>
          <p className="mt-1 text-muted">Signed in as {user.name}</p>
        </div>
        <form action={logout}><button className={buttonClass("ghost", "sm")}>Sign out</button></form>
      </div>

      {items.length === 0 ? (
        <Card className="mt-10">
          <EmptyState title="No enquiries yet" body="Enquiries you send while signed in will appear here, with every reply and quote." action={<ButtonLink href="/enquire">Plan a trip</ButtonLink>} />
        </Card>
      ) : (
        <div className="mt-10 space-y-6">
          {items.map((e) => (
            <Card key={e.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="tabular text-sm text-muted">{e.ref} · {fmt(e.createdAt)}</p>
                <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
              </div>
              <p className="mt-3 text-ink-2">{e.message}</p>
              {e.quotes.map((q) => (
                <Link key={q.id} href={`/q/${q.token}`} className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-paper p-3 hover:border-accent">
                  <span className="flex items-center gap-2 text-sm"><FileText size={16} className="text-accent" /> Quote {q.ref}: {q.title}</span>
                  <span className="tabular text-sm font-medium">{formatINR(q.price.total)}</span>
                </Link>
              ))}
              {e.messages.filter((m) => m.kind === "reply").slice(0, 1).map((m) => (
                <details key={m.id} className="mt-4 rounded-lg bg-sand/60 p-3 text-sm">
                  <summary className="flex cursor-pointer items-center gap-2 text-ink-2"><MessageSquare size={14} /> Latest reply, {fmt(m.createdAt)}</summary>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-ink-2">{m.body}</pre>
                </details>
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
