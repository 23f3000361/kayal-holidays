"use client";

import { useSyncExternalStore } from "react";
import { Globe, Mail, MessageCircle, MessagesSquare, Phone } from "lucide-react";
import { slaState } from "@/lib/sla";
import { Badge, cx } from "@/components/ui";
import type { Channel } from "@/lib/constants";

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="min-w-0">
          {back}
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("mx-auto max-w-[1400px] px-4 py-6 sm:px-8", className)}>{children}</div>;
}

const CH: Record<Channel, { label: string; Icon: typeof Globe }> = {
  web: { label: "Web form", Icon: Globe },
  chat: { label: "Chat", Icon: MessagesSquare },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle },
  email: { label: "Email", Icon: Mail },
  phone: { label: "Phone", Icon: Phone },
};

export function ChannelIcon({ channel, withLabel }: { channel: Channel; withLabel?: boolean }) {
  const { label, Icon } = CH[channel];
  return (
    <span className="inline-flex items-center gap-1.5 text-muted" title={label}>
      <Icon size={14} strokeWidth={1.8} aria-hidden />
      {withLabel ? <span className="text-xs">{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}

function fmtMins(m: number) {
  const a = Math.abs(m);
  if (a < 60) return `${a} min`;
  const h = Math.floor(a / 60);
  return a % 60 ? `${h} h ${a % 60} min` : `${h} h`;
}

// One shared 30-second clock for every badge on the page. The server snapshot is 0,
// so badges render after hydration and never mismatch the server HTML.
const clock = { now: 0, subs: new Set<() => void>(), timer: undefined as ReturnType<typeof setInterval> | undefined };
function subscribe(cb: () => void) {
  clock.subs.add(cb);
  if (clock.subs.size === 1) {
    clock.now = Date.now();
    clock.timer = setInterval(() => {
      clock.now = Date.now();
      clock.subs.forEach((f) => f());
    }, 30_000);
  }
  return () => {
    clock.subs.delete(cb);
    if (clock.subs.size === 0) clearInterval(clock.timer);
  };
}
const useNow = () => useSyncExternalStore(subscribe, () => clock.now, () => 0);

/** Live countdown to the one-working-hour reply target. */
export function SlaBadge({ createdAt, firstReplyAt, closed }: { createdAt: string | Date; firstReplyAt: string | Date | null; closed?: boolean }) {
  const now = useNow();
  if (!now) return <Badge tone="neutral" className="opacity-0">—</Badge>;
  const s = slaState(new Date(createdAt), firstReplyAt ? new Date(firstReplyAt) : null, new Date(now));
  if (s.kind === "done") return <Badge tone={s.withinTarget ? "ok" : "neutral"}>{`Replied in ${fmtMins(s.minutes)}`}</Badge>;
  if (closed) return null;
  if (s.overdue) return <Badge tone="danger">{`Overdue ${fmtMins(s.minutesLeft)}`}</Badge>;
  return <Badge tone={s.minutesLeft <= 15 ? "warn" : "accent"}>{`Reply in ${fmtMins(s.minutesLeft)}`}</Badge>;
}

export function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.85 ? "ok" : value >= 0.7 ? "accent" : "warn";
  return <Badge tone={tone} className="tabular">{value >= 1 ? "Checked" : `${pct}%`}</Badge>;
}
