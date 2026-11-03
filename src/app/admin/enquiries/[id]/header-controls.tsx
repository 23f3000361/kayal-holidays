"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignAction, statusAction } from "@/app/admin/actions";
import { Button, Spinner, inputClass, cx } from "@/components/ui";
import { STATUSES } from "@/lib/constants";

const LABEL: Record<string, string> = { new: "New", replied: "Replied", quoted: "Quoted", booked: "Booked", lost: "Lost", spam: "Spam" };

export function HeaderControls({ id, status, assignedToId, staff, canAssign, meId }: { id: string; status: string; assignedToId: string | null; staff: { id: string; name: string; role: string }[]; canAssign: boolean; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Failed");
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Spinner className="text-muted" />}
      {error && <span role="alert" className="text-sm text-danger">{error}</span>}
      <label className="sr-only" htmlFor="status">Status</label>
      <select id="status" value={status} disabled={pending} onChange={(e) => act(() => statusAction(id, e.target.value))} className={cx(inputClass, "w-auto py-1.5")}>
        {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
      </select>
      {canAssign ? (
        <>
          <label className="sr-only" htmlFor="assignee">Assigned to</label>
          <select id="assignee" value={assignedToId ?? ""} disabled={pending} onChange={(e) => act(() => assignAction(id, e.target.value || null))} className={cx(inputClass, "w-auto py-1.5")}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </>
      ) : !assignedToId ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => assignAction(id, meId))}>Take this enquiry</Button>
      ) : null}
    </div>
  );
}
