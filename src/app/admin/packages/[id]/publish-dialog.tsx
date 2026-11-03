"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarClock, Rocket, X } from "lucide-react";
import type { PackageContent, Problem } from "@/lib/package-content";
import { diffContent } from "@/lib/versions";
import { Alert, Button, Field, Spinner, inputClass, cx } from "@/components/ui";

export function PublishDialog({ open, onClose, draft, live, problems, scheduled, onPublish }: {
  open: boolean; onClose: () => void; draft: PackageContent; live: PackageContent | null; problems: Problem[]; scheduled: { versionNo: number; publishAt: string }[];
  onPublish: (input: { publishAt?: string; note: string }) => Promise<string | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changes = diffContent(live, draft);
  const errors = problems.filter((p) => p.level === "error");
  const warnings = problems.filter((p) => p.level === "warning");
  const at = mode === "later" && when ? new Date(when) : new Date();
  const replaced = scheduled.filter((r) => new Date(r.publishAt) >= at);
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const go = () =>
    start(async () => {
      setError(null);
      if (mode === "later" && (!when || new Date(when) <= new Date())) return setError("Pick a date and time in the future.");
      const err = await onPublish({ publishAt: mode === "later" ? new Date(when).toISOString() : undefined, note });
      if (err) setError(err);
    });

  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-ink/40">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-medium">Publish to the website</h2>
        <button aria-label="Close" onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-sand"><X size={18} /></button>
      </div>
      <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5">
        {errors.length > 0 && (
          <Alert tone="danger" title="Fix these first">
            <ul className="mt-1 list-disc pl-4">{errors.map((p) => <li key={p.message}>{p.message}</li>)}</ul>
          </Alert>
        )}
        <div>
          <p className="text-sm font-medium text-ink-2">{live ? "What changes on the live page" : "This package goes live for the first time"}</p>
          {live && (changes.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No changes compared with the live version.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
              {changes.map((c, i) => (
                <li key={i} className="grid gap-1 px-3 py-2 sm:grid-cols-[150px_1fr]">
                  <span className="text-muted">{c.label}</span>
                  <span className="min-w-0"><span className="text-faint line-through">{c.before.slice(0, 120)}</span> <span className="text-ink">→ {c.after.slice(0, 120)}</span></span>
                </li>
              ))}
            </ul>
          ))}
        </div>
        {replaced.length > 0 && (
          <Alert tone="warn" title={`This replaces scheduled version${replaced.length > 1 ? "s" : ""} ${replaced.map((r) => "v" + r.versionNo).join(", ")}`}>
            {replaced.map((r) => `v${r.versionNo} was due ${fmt(r.publishAt)}`).join("; ")}. It will be cancelled, because a newer version always wins. Its changes go live only if they are in this draft (check the list above). To keep a future change, schedule it again after publishing.
          </Alert>
        )}
        {warnings.length > 0 && <Alert tone="warn" title="Worth a look (won't block publishing)"><ul className="mt-1 list-disc pl-4">{warnings.map((p) => <li key={p.message}>{p.message}</li>)}</ul></Alert>}
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium text-ink-2">When</legend>
          {(["now", "later"] as const).map((m) => (
            <label key={m} className={cx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm", mode === m ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink-2")}>
              <input type="radio" name="when" checked={mode === m} onChange={() => setMode(m)} className="accent-[var(--color-accent)]" />
              {m === "now" ? <><Rocket size={15} /> Publish now</> : <><CalendarClock size={15} /> Schedule</>}
            </label>
          ))}
        </fieldset>
        {mode === "later" && (
          <Field label="Go live at (your local time)" htmlFor="when" hint="The live page switches over by itself at this time, e.g. new season prices on 1 October.">
            <input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} />
          </Field>
        )}
        <Field label="What changed (for the history)" htmlFor="note">
          <input id="note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Peak price updated for 2027" className={inputClass} />
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={go} disabled={pending || errors.length > 0}>{pending && <Spinner />} {mode === "now" ? "Publish now" : "Schedule"}</Button>
      </div>
    </dialog>
  );
}
