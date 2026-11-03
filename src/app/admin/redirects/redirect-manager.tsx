"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, FileUp, Plus, Search, Trash2 } from "lucide-react";
import { addOneAction, deleteAction, importAction, previewImportAction } from "./actions";
import { Alert, Badge, Button, Card, EmptyState, Field, Spinner, inputClass, cx } from "@/components/ui";

type Row = { id: string; from: string; to: string; hits: number; lastHitAt: string | null; broken: boolean };
type Preview = { ok: { from: string; to: string }[]; issues: { line: number; from: string; to: string; error: string }[] };

export function RedirectManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [one, setOne] = useState({ from: "", to: "" });
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? rows.filter((r) => r.from.includes(n) || r.to.includes(n)) : rows;
  }, [rows, q]);

  const done = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    if (ok) router.refresh();
  };

  return (
    <div className="space-y-6">
      {msg && <p role="status" className={cx("text-sm", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-medium text-ink"><Plus size={16} className="text-muted" /> Add one</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await addOneAction(one.from, one.to);
                if (r.ok) setOne({ from: "", to: "" });
                done(r.ok, r.ok ? "Redirect added." : r.error);
              });
            }}
          >
            <Field label="Old URL" htmlFor="from" hint="A path or full address from the old site, e.g. /kerala-tour-packages.html">
              <input id="from" required value={one.from} onChange={(e) => setOne({ ...one, from: e.target.value })} className={inputClass} />
            </Field>
            <Field label="New page" htmlFor="to" hint="A page on this site, e.g. /packages/coorg-mysore">
              <input id="to" required value={one.to} onChange={(e) => setOne({ ...one, to: e.target.value })} className={inputClass} />
            </Field>
            <Button type="submit" disabled={pending}>{pending && <Spinner />} Add redirect</Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-medium text-ink"><FileUp size={16} className="text-muted" /> Import a list</h2>
          <p className="mt-1 text-sm text-muted">Paste two columns from a spreadsheet or crawl report: old URL, new URL. Check it first; nothing changes until you import.</p>
          <label htmlFor="csv" className="sr-only">Redirect list</label>
          <textarea id="csv" rows={6} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} placeholder={"from,to\n/kerala-honeymoon.html,/packages/kerala-honeymoon-munnar-thekkady-kumarakom"} className={cx(inputClass, "mt-3 font-mono text-[13px]")} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={pending || !csv.trim()} onClick={() => start(async () => { const r = await previewImportAction(csv); if (r.ok) setPreview(r.data!); else done(false, r.error); })}>{pending && !preview && <Spinner />} Check list</Button>
            {preview && preview.ok.length > 0 && (
              <Button disabled={pending} onClick={() => start(async () => { const r = await importAction(csv); if (r.ok) { setCsv(""); setPreview(null); } done(r.ok, r.ok ? `Imported ${r.data!.added} redirect${r.data!.added === 1 ? "" : "s"}${r.data!.skipped ? `; skipped ${r.data!.skipped} with problems` : ""}.` : r.error); })}>
                Import {preview.ok.length} redirect{preview.ok.length === 1 ? "" : "s"}
              </Button>
            )}
          </div>
          {preview && (
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-ok">{preview.ok.length} ready to import</p>
              {preview.issues.length > 0 && (
                <div className="rounded-lg border border-line">
                  <p className="border-b border-line px-3 py-2 font-medium text-danger">{preview.issues.length} will be skipped</p>
                  <ul className="max-h-48 divide-y divide-line overflow-y-auto">
                    {preview.issues.map((i, k) => (
                      <li key={k} className="px-3 py-2"><span className="tabular text-muted">Line {i.line}: </span><span className="break-all text-ink-2">{i.from || "—"} → {i.to || "—"}</span><br /><span className="text-danger">{i.error}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="relative w-full max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by URL" aria-label="Filter redirects" className={cx(inputClass, "py-1.5 pl-9")} />
          </div>
          {selected.size > 0 && (
            <Button size="sm" variant="danger" disabled={pending} onClick={() => { if (confirm(`Remove ${selected.size} redirect(s)? Old links will then show the 404 page.`)) start(async () => { const r = await deleteAction([...selected]); setSelected(new Set()); done(r.ok, r.ok ? `Removed ${r.data}.` : r.error); }); }}>
              <Trash2 size={14} /> Remove {selected.size}
            </Button>
          )}
        </div>
        {shown.length === 0 ? (
          <EmptyState title={rows.length ? "No redirect matches that filter" : "No redirects yet"} body={rows.length ? undefined : "Add the old site's URLs above so nothing breaks on launch day."} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs text-muted">
              <tr>
                <th className="w-10 px-5 py-2"><span className="sr-only">Select</span></th>
                <th className="py-2 pr-3 font-medium">Old URL</th>
                <th className="py-2 pr-3 font-medium">New page</th>
                <th className="hidden py-2 pr-5 text-right font-medium sm:table-cell">Visits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr key={r.id} className={cx(r.broken && "bg-danger-soft/40")}>
                  <td className="px-5 py-2.5">
                    <input type="checkbox" aria-label={`Select ${r.from}`} checked={selected.has(r.id)} onChange={(e) => { const s = new Set(selected); if (e.target.checked) s.add(r.id); else s.delete(r.id); setSelected(s); }} className="accent-[var(--color-accent)]" />
                  </td>
                  <td className="break-all py-2.5 pr-3 font-mono text-[12.5px] text-ink-2">{r.from}</td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-start gap-1.5 break-all">
                      <ArrowRight size={13} className="mt-1 shrink-0 text-faint" />
                      <a href={r.to} target="_blank" className="font-mono text-[12.5px] text-accent hover:underline">{r.to}</a>
                      {r.broken && <Badge tone="danger"><AlertTriangle size={11} /> page gone</Badge>}
                    </span>
                  </td>
                  <td className="tabular hidden py-2.5 pr-5 text-right text-muted sm:table-cell">{r.hits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {rows.some((r) => r.broken) && <Alert tone="warn">Red rows point at a page that was unpublished or renamed. Remove them and add them again with a new target.</Alert>}
    </div>
  );
}
