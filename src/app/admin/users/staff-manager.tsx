"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, UserPlus } from "lucide-react";
import { createStaffAction, resetPasswordAction, setActiveAction, setRoleAction } from "./actions";
import { STAFF_ROLES } from "@/lib/staff";
import { ROLE_LABELS } from "@/lib/permissions";
import { Alert, Badge, Button, Card, Field, Spinner, inputClass, cx } from "@/components/ui";

type Staff = { id: string; name: string; email: string; role: string; active: boolean; openEnquiries: number; createdAt: string };

const ROLE_HELP: Record<string, string> = {
  admin: "Everything, including the team and the activity log",
  editor: "Packages and the journal; cannot see enquiries",
  consultant: "Enquiries and quotes; can view packages",
};

export function StaffManager({ staff, meId }: { staff: Staff[]; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [secret, setSecret] = useState<{ name: string; password: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "consultant" });

  const act = (fn: () => Promise<{ ok: boolean; error?: string; data?: { released?: number; password?: string } }>, done: string, name: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setMsg({ ok: false, text: r.error! });
      const released = r.data?.released ? ` ${r.data.released} open enquir${r.data.released === 1 ? "y" : "ies"} returned to the unassigned pool.` : "";
      setMsg({ ok: true, text: done + released });
      if (r.data?.password) setSecret({ name, password: r.data.password });
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {secret && (
        <Alert tone="ok" title={`One-time password for ${secret.name}`}>
          <span className="flex flex-wrap items-center gap-3">
            <code className="tabular rounded bg-white px-2 py-1 text-base text-ink">{secret.password}</code>
            <button className="inline-flex items-center gap-1 text-sm underline" onClick={() => navigator.clipboard.writeText(secret.password)}><Copy size={13} /> Copy</button>
            <span className="text-sm">Share it privately. It is not shown again, and it isn&apos;t stored in readable form.</span>
          </span>
        </Alert>
      )}
      {msg && <p role="status" className={cx("text-sm", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</p>}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {staff.map((u) => (
            <li key={u.id} className={cx("grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-center", !u.active && "bg-paper")}>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {u.name}
                  {u.id === meId && <Badge tone="accent">You</Badge>}
                  {!u.active && <Badge tone="neutral">Deactivated</Badge>}
                </p>
                <p className="truncate text-sm text-muted">{u.email}{u.openEnquiries ? ` · ${u.openEnquiries} open enquir${u.openEnquiries === 1 ? "y" : "ies"}` : ""}</p>
              </div>
              <div>
                <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.name}</label>
                <select id={`role-${u.id}`} value={u.role} disabled={pending || !u.active} onChange={(e) => act(() => setRoleAction(u.id, e.target.value), `${u.name} is now ${ROLE_LABELS[e.target.value as keyof typeof ROLE_LABELS]}.`, u.name)} className={inputClass}>
                  {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button size="sm" variant="ghost" disabled={pending || !u.active} onClick={() => act(() => resetPasswordAction(u.id), `Password reset for ${u.name}; they were signed out.`, u.name)}><KeyRound size={14} /> Reset password</Button>
                {u.active ? (
                  <Button size="sm" variant="danger" disabled={pending || u.id === meId} onClick={() => { if (confirm(`Deactivate ${u.name}? They are signed out at once and their open enquiries go back to the unassigned pool.`)) act(() => setActiveAction(u.id, false), `${u.name} was deactivated.`, u.name); }}>Deactivate</Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => setActiveAction(u.id, true), `${u.name} can sign in again.`, u.name)}>Reactivate</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-medium text-ink"><UserPlus size={17} className="text-muted" /> Add a team member</h2>
        <form
          className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_220px_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const r = await createStaffAction(form);
              if (r.ok) setForm({ name: "", email: "", role: "consultant" });
              return r;
            }, `${form.name} was added.`, form.name);
          }}
        >
          <Field label="Name" htmlFor="new-name"><input id="new-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></Field>
          <Field label="Work email" htmlFor="new-email"><input id="new-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></Field>
          <Field label="Role" htmlFor="new-role">
            <select id="new-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
          <Button type="submit" disabled={pending}>{pending && <Spinner />} Add</Button>
        </form>
        <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
          {STAFF_ROLES.map((r) => <div key={r}><dt className="font-medium text-ink-2">{ROLE_LABELS[r]}</dt><dd className="text-muted">{ROLE_HELP[r]}</dd></div>)}
        </dl>
      </Card>
    </div>
  );
}
