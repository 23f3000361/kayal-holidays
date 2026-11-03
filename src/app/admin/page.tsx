import Link from "next/link";
import { and, gte, inArray, isNull, or, eq } from "drizzle-orm";
import { ArrowRight, CalendarClock, PencilLine } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireUser, type CurrentUser } from "@/server/auth";
import { adminListPackages } from "@/server/packages";
import { can } from "@/lib/permissions";
import { SLA_MINUTES, workingMinutesBetween } from "@/lib/sla";
import { Alert, Card, EmptyState } from "@/components/ui";
import { PageBody, PageHeader, SlaBadge, ChannelIcon } from "@/components/admin/bits";

export const dynamic = "force-dynamic";

function median(xs: number[]) {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

/** Reply-time figures for the last 30 days, scoped to what this user may see. */
async function enquiryStats(user: CurrentUser, now: Date) {
  const scope = can(user.role, "enquiries.viewAll") ? undefined : or(eq(s.enquiries.assignedToId, user.id), isNull(s.enquiries.assignedToId));
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [open, recent] = await Promise.all([
    db.select({ e: s.enquiries, assignee: s.users.name }).from(s.enquiries).leftJoin(s.users, eq(s.users.id, s.enquiries.assignedToId)).where(and(inArray(s.enquiries.status, ["new"]), isNull(s.enquiries.firstReplyAt), scope)).orderBy(s.enquiries.dueAt),
    db.select().from(s.enquiries).where(and(gte(s.enquiries.createdAt, since), scope)),
  ]);
  const times = recent.filter((e) => e.firstReplyAt && e.status !== "spam").map((e) => workingMinutesBetween(e.createdAt, e.firstReplyAt!));
  const within = times.filter((t) => t <= SLA_MINUTES).length;
  return {
    open,
    recent,
    times,
    within,
    pct: times.length ? Math.round((within / times.length) * 100) : null,
    overdue: open.filter((x) => x.e.dueAt < now).length,
    med: median(times),
  };
}

function Stat({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: string; tone?: "danger" | "ok" }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`tabular mt-2 text-3xl font-semibold tracking-tight ${tone === "danger" ? "text-danger" : tone === "ok" ? "text-ok" : "text-ink"}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </Card>
  );
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser("admin.access");
  const { denied } = await searchParams;
  const hour = Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date()));
  const greeting = `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`;

  const seeEnquiries = can(user.role, "enquiries.view");
  let enquiryBlock: React.ReactNode = null;
  if (seeEnquiries) {
    const { open, recent, times, within, pct, overdue, med } = await enquiryStats(user, new Date());

    enquiryBlock = (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Waiting for a first reply" value={open.length} note={overdue ? `${overdue} past the one-hour target` : "None overdue"} tone={overdue ? "danger" : undefined} />
          <Stat label="Answered within 1 working hour" value={pct === null ? "—" : `${pct}%`} note={`${within} of ${times.length} in the last 30 days · target 90%`} tone={pct !== null && pct >= 90 ? "ok" : undefined} />
          <Stat label="Median first reply" value={med === null ? "—" : `${med} min`} note="Working minutes, Mon–Sat 9–7 IST" />
          <Stat label="Enquiries, last 30 days" value={recent.length} note={`${recent.filter((e) => e.status === "booked").length} booked so far`} />
        </div>
        <Card className="mt-6">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-medium text-ink">Needs a reply</h2>
            <Link href="/admin/enquiries" className="flex items-center gap-1 text-sm text-accent hover:underline">Open inbox <ArrowRight size={14} /></Link>
          </div>
          {open.length === 0 ? (
            <EmptyState title="All caught up" body="Every enquiry has had a first reply." />
          ) : (
            <ul className="divide-y divide-line">
              {open.slice(0, 8).map(({ e, assignee }) => (
                <li key={e.id}>
                  <Link href={`/admin/enquiries/${e.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-paper">
                    <ChannelIcon channel={e.channel} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{e.name} <span className="tabular font-normal text-muted">· {e.ref}</span></p>
                      <p className="truncate text-sm text-muted">{e.message}</p>
                    </div>
                    <span className="hidden text-xs text-muted sm:block">{assignee ?? "Unassigned"}</span>
                    <SlaBadge createdAt={e.createdAt} firstReplyAt={null} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </>
    );
  }

  const packages = await adminListPackages();
  const dirty = packages.filter((p) => p.status.label === "Changes not published" || p.status.label === "Draft");
  const scheduled = packages.filter((p) => p.status.scheduledAt);

  return (
    <>
      <PageHeader title={greeting} subtitle={new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" })} />
      <PageBody className="space-y-6">
        {denied && <Alert tone="warn" title="That page isn't available for your role">Ask an admin if you need access.</Alert>}
        {enquiryBlock}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="flex items-center gap-2 font-medium text-ink"><PencilLine size={16} className="text-muted" /> Drafts and unpublished changes</h2>
              <Link href="/admin/packages" className="text-sm text-accent hover:underline">Packages</Link>
            </div>
            {dirty.length === 0 ? <EmptyState title="Everything is published" /> : (
              <ul className="divide-y divide-line">
                {dirty.map((p) => (
                  <li key={p.id}><Link href={`/admin/packages/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-paper"><span className="truncate text-ink">{p.title}</span><span className="shrink-0 text-xs text-muted">{p.status.label}</span></Link></li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <div className="border-b border-line px-5 py-3.5"><h2 className="flex items-center gap-2 font-medium text-ink"><CalendarClock size={16} className="text-muted" /> Scheduled to go live</h2></div>
            {scheduled.length === 0 ? <EmptyState title="Nothing scheduled" /> : (
              <ul className="divide-y divide-line">
                {scheduled.map((p) => (
                  <li key={p.id}><Link href={`/admin/packages/${p.id}/history`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-paper"><span className="truncate text-ink">{p.title}</span><span className="tabular shrink-0 text-xs text-muted">{p.status.scheduledAt!.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</span></Link></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
