"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, FileText, Inbox, Mail, MessageCircle, PenLine, Send, Tag, UserRound } from "lucide-react";
import { noteAction } from "@/app/admin/actions";
import { Button, Card, Spinner, inputClass, cx } from "@/components/ui";

type Ev = { id: string; type: string; body: string; actor: string | null; at: string };
type Msg = { id: string; kind: string; channel: string; to: string; subject: string; body: string; at: string };

const ICON: Record<string, typeof Inbox> = { received: Inbox, ack: Mail, ai: Bot, note: PenLine, reply: Send, status: Tag, assign: UserRound, quote: FileText, correction: CheckCircle2 };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function Timeline({ id, events, messages }: { id: string; events: Ev[]; messages: Msg[] }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const add = () =>
    start(async () => {
      const r = await noteAction(id, note);
      if (r.ok) {
        setNote("");
        setError(null);
        router.refresh();
      } else setError(r.error);
    });

  return (
    <Card>
      <div className="border-b border-line px-5 py-4"><h2 className="font-medium text-ink">Notes and history</h2></div>
      <div className="px-5 py-4">
        <label htmlFor="note" className="sr-only">Add a note</label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add an internal note (the traveller never sees it)" className={cx(inputClass, "resize-y")} />
        <div className="mt-2 flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={add} disabled={pending || !note.trim()}>{pending && <Spinner />} Add note</Button>
          {error && <span role="alert" className="text-sm text-danger">{error}</span>}
        </div>

        {messages.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Outbox (simulated delivery)</p>
            <ul className="mt-2 space-y-2">
              {messages.map((m) => (
                <li key={m.id}>
                  <details className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                    <summary className="flex cursor-pointer items-center gap-2">
                      {m.channel === "email" ? <Mail size={14} className="text-muted" /> : <MessageCircle size={14} className="text-muted" />}
                      <span className="text-ink">{m.kind === "ack" ? "Automatic acknowledgement" : "Reply"}</span>
                      <span className="truncate text-muted">to {m.to}</span>
                      <span className="tabular ml-auto shrink-0 text-xs text-faint">{when(m.at)}</span>
                    </summary>
                    {m.subject && <p className="mt-2 font-medium text-ink-2">{m.subject}</p>}
                    <pre className="mt-1 whitespace-pre-wrap font-sans text-ink-2">{m.body}</pre>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ol className="mt-6 space-y-3">
          {events.map((e) => {
            const Icon = ICON[e.type] ?? Tag;
            return (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className={cx("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", e.type === "note" ? "bg-warn-soft text-warn" : "bg-sand text-muted")}><Icon size={13} /></span>
                <div className="min-w-0">
                  <p className={cx(e.type === "note" ? "whitespace-pre-wrap text-ink" : "text-ink-2")}>{e.body}</p>
                  <p className="tabular text-xs text-faint">{e.actor ? `${e.actor} · ` : ""}{when(e.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
