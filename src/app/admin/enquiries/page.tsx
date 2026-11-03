import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Inbox } from "lucide-react";
import { requireUser } from "@/server/auth";
import { inboxCounts, listInbox, type InboxFilter } from "@/server/enquiries";
import { summaryChips } from "@/lib/ai/summary";
import { can } from "@/lib/permissions";
import { CHANNELS, type Channel } from "@/lib/constants";
import { Badge, Card, EmptyState, buttonClass, inputClass, cx } from "@/components/ui";
import { ChannelIcon, PageBody, PageHeader, SlaBadge } from "@/components/admin/bits";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

const STATUS_TONE = { new: "info", replied: "accent", quoted: "accent", booked: "ok", lost: "neutral", spam: "neutral" } as const;

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("enquiries.view", "/admin/enquiries");
  const sp = await searchParams;
  const view = (["open", "mine", "unassigned", "closed", "all"].includes(sp.view ?? "") ? sp.view : "open") as InboxFilter["view"];
  const channel = CHANNELS.includes(sp.channel as Channel) ? (sp.channel as Channel) : undefined;
  const [rows, counts] = await Promise.all([listInbox(user, { view, q: sp.q, channel }), inboxCounts(user)]);

  const tabs = [
    { key: "open", label: "Open", n: counts.open },
    { key: "mine", label: "Mine", n: counts.mine },
    { key: "unassigned", label: "Unassigned", n: counts.unassigned },
    { key: "closed", label: "Closed" },
    { key: "all", label: "All" },
  ];
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ view, q: sp.q, channel, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/enquiries?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle={<>Every channel in one place. {counts.overdue ? <span className="text-danger">{counts.overdue} overdue.</span> : "Nothing overdue."}{!can(user.role, "enquiries.viewAll") && " You see your enquiries and the unassigned pool."}</>}
        actions={can(user.role, "enquiries.log") && <Link href="/admin/enquiries/new" className={buttonClass("primary")}><Plus size={16} /> Log an enquiry</Link>}
      />
      <PageBody>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Inbox views">
            {tabs.map((t) => (
              <Link key={t.key} href={href({ view: t.key })} aria-current={view === t.key ? "page" : undefined} className={cx("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm", view === t.key ? "bg-ink text-white" : "text-ink-2 hover:bg-sand")}>
                {t.label}
                {t.n !== undefined && <span className={cx("tabular text-xs", view === t.key ? "text-white/70" : "text-muted")}>{t.n}</span>}
              </Link>
            ))}
          </nav>
          <form className="flex gap-2" role="search">
            <input type="hidden" name="view" value={view} />
            <select name="channel" defaultValue={channel ?? ""} aria-label="Channel" className={cx(inputClass, "w-36")}>
              <option value="">All channels</option>
              {CHANNELS.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
            <div className="relative flex-1 lg:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input name="q" defaultValue={sp.q} placeholder="Name, ref or words" aria-label="Search enquiries" className={cx(inputClass, "pl-9")} />
            </div>
          </form>
        </div>

        <Card className="mt-4 overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={<Inbox size={28} />} title={sp.q ? "No enquiries match that search" : view === "open" ? "No open enquiries" : "Nothing here"} body={sp.q ? "Try a name, a reference like ENQ-10015 or a word from the message." : "New enquiries from every channel arrive here automatically."} />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => {
                const chips = summaryChips(r.fields);
                const closed = ["booked", "lost", "spam"].includes(r.status);
                return (
                  <li key={r.id}>
                    <Link href={`/admin/enquiries/${r.id}`} className="grid gap-2 px-4 py-3.5 hover:bg-paper sm:px-5 lg:grid-cols-[minmax(0,1fr)_150px_130px] lg:items-center lg:gap-6">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ChannelIcon channel={r.channel} />
                          <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                          <span className="tabular shrink-0 text-xs text-faint">{r.ref}</span>
                          {r.status !== "new" && <Badge tone={STATUS_TONE[r.status]} className="capitalize">{r.status}</Badge>}
                        </div>
                        <p className="mt-1 truncate text-sm text-muted">{r.message}</p>
                        {chips.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {chips.map((c) => <span key={c.text} className={cx("tabular rounded-md px-1.5 py-0.5 text-xs", c.weak ? "bg-warn-soft text-warn" : "bg-sand text-ink-2")}>{c.text}</span>)}
                            {r.confirmed && <span className="rounded-md bg-ok-soft px-1.5 py-0.5 text-xs text-ok">checked</span>}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted lg:text-sm">{r.assignee ?? <span className="text-warn">Unassigned</span>}</p>
                      <div className="flex items-center justify-between gap-2 lg:block lg:text-right">
                        <p className="tabular text-xs text-faint lg:mb-1">{r.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
                        <SlaBadge createdAt={r.createdAt} firstReplyAt={r.firstReplyAt} closed={closed} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </PageBody>
    </>
  );
}
