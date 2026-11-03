import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { requireUser } from "@/server/auth";
import { inboxCounts } from "@/server/enquiries";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { logout } from "@/app/login/actions";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Kayal admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("admin.access");
  const counts = can(user.role, "enquiries.view") ? await inboxCounts(user) : null;
  const items = [
    { href: "/admin", label: "Overview", icon: "home" as const, exact: true },
    ...(can(user.role, "enquiries.view") ? [{ href: "/admin/enquiries", label: "Inbox", icon: "inbox" as const, badge: counts?.unanswered || undefined, alert: !!counts?.overdue }] : []),
    { href: "/admin/packages", label: "Packages", icon: "package" as const },
    ...(can(user.role, "blog.edit") ? [{ href: "/admin/blog", label: "Journal", icon: "journal" as const }] : []),
    ...(can(user.role, "audit.view") ? [{ href: "/admin/activity", label: "Activity", icon: "activity" as const }] : []),
  ];

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-line bg-surface lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-4 lg:h-16 lg:px-5">
          <Link href="/admin" className="font-display text-xl text-ink">Kayal<span className="text-gold">.</span> <span className="font-sans text-xs font-normal text-muted">admin</span></Link>
          <form action={logout} className="lg:hidden"><button aria-label="Sign out" className="rounded-md p-2 text-muted hover:bg-sand"><LogOut size={18} /></button></form>
        </div>
        <AdminNav items={items} />
        <div className="absolute inset-x-0 bottom-0 hidden border-t border-line p-4 lg:block">
          <Link href="/" target="_blank" className="mb-3 flex items-center gap-1.5 text-xs text-muted hover:text-ink"><ExternalLink size={12} /> View website</Link>
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="text-xs text-muted">{ROLE_LABELS[user.role]}</p>
          <form action={logout} className="mt-3"><button className="flex items-center gap-1.5 text-xs text-muted hover:text-ink"><LogOut size={12} /> Sign out</button></form>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
