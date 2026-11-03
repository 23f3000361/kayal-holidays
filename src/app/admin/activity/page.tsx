import type { Metadata } from "next";
import { desc, eq, like } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/server/auth";
import { Card, EmptyState, inputClass, cx } from "@/components/ui";
import { PageBody, PageHeader } from "@/components/admin/bits";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const KINDS = [["", "Everything"], ["package.", "Packages"], ["enquiry.", "Enquiries"], ["quote.", "Quotes"], ["auth.", "Sign-ins"], ["media.", "Uploads"]] as const;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireUser("audit.view", "/admin/activity");
  const { kind = "" } = await searchParams;
  const safe = KINDS.some(([k]) => k === kind) ? kind : "";
  const rows = await db
    .select({ a: s.auditLog, who: s.users.name })
    .from(s.auditLog)
    .leftJoin(s.users, eq(s.users.id, s.auditLog.actorId))
    .where(safe ? like(s.auditLog.action, `${safe}%`) : undefined)
    .orderBy(desc(s.auditLog.createdAt))
    .limit(300);

  return (
    <>
      <PageHeader title="Activity" subtitle="Who changed what, newest first. Kept for accountability; entries cannot be edited." />
      <PageBody className="max-w-4xl">
        <form className="flex gap-2">
          <select name="kind" defaultValue={safe} aria-label="Filter" className={cx(inputClass, "w-48")}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <button className="rounded-lg border border-line-strong px-3 text-sm hover:bg-sand">Filter</button>
        </form>
        <Card className="mt-4">
          {rows.length === 0 ? <EmptyState title="No activity yet" /> : (
            <ul className="divide-y divide-line">
              {rows.map(({ a, who }) => (
                <li key={a.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[150px_1fr_160px] sm:gap-4">
                  <span className="tabular text-muted">{a.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="text-ink">{a.summary}</span>
                  <span className="text-muted sm:text-right">{who ?? "System"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageBody>
    </>
  );
}
