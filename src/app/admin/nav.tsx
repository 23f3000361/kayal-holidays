"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Home, Inbox, NotebookPen, Package, Users } from "lucide-react";
import { cx } from "@/components/ui";

const ICONS = { home: Home, inbox: Inbox, package: Package, journal: NotebookPen, team: Users, activity: Activity };

type Item = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; alert?: boolean; exact?: boolean };

export function AdminNav({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-col lg:px-3 lg:pb-0 lg:pt-2">
      {items.map((it) => {
        const active = it.exact ? path === it.href : path.startsWith(it.href);
        const Icon = ICONS[it.icon];
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={cx("flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-sand")}>
            <Icon size={17} strokeWidth={1.8} />
            {it.label}
            {it.badge ? <span className={cx("tabular ml-auto rounded-full px-1.5 text-xs font-medium", it.alert ? "bg-danger text-white" : "bg-sand text-ink-2")}>{it.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
