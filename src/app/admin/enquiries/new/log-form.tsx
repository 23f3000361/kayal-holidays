"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logEnquiryAction } from "@/app/admin/actions";
import { Alert, Button, Card, Field, Spinner, inputClass, cx } from "@/components/ui";
import { CHANNELS, type Channel } from "@/lib/constants";

const LABEL: Record<Channel, string> = { web: "Website", chat: "Website chat", whatsapp: "WhatsApp", email: "Email", phone: "Phone call" };

export function LogForm() {
  const router = useRouter();
  const [v, setV] = useState({ channel: "phone" as Channel, name: "", email: "", phone: "", message: "", whatsapp: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((x) => ({ ...x, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await logEnquiryAction(v);
      if (r.ok) router.push(`/admin/enquiries/${r.data}`);
      else setError(r.error);
    });
  };

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        <fieldset>
          <legend className="text-sm font-medium text-ink-2">Channel</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CHANNELS.filter((c) => c !== "web").map((c) => (
              <button key={c} type="button" aria-pressed={v.channel === c} onClick={() => set("channel", c)} className={cx("rounded-lg border px-3 py-1.5 text-sm", v.channel === c ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink-2")}>{LABEL[c]}</button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Name" htmlFor="name"><input id="name" required value={v.name} onChange={(e) => set("name", e.target.value)} className={inputClass} /></Field>
          <Field label="Email" htmlFor="email"><input id="email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} className={inputClass} /></Field>
          <Field label="Phone" htmlFor="phone"><input id="phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91" className={inputClass} /></Field>
        </div>
        <Field label="Message" htmlFor="message" hint="Paste the chat or email, or write what the caller said. The assistant reads it the same way as a web enquiry.">
          <textarea id="message" rows={6} required value={v.message} onChange={(e) => set("message", e.target.value)} className={cx(inputClass, "resize-y")} />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={v.whatsapp} onChange={(e) => set("whatsapp", e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
          <span className="text-ink-2">The traveller agreed to WhatsApp follow-ups (record only if they said so)</span>
        </label>
        <Button type="submit" disabled={pending}>{pending && <Spinner />} Log enquiry</Button>
      </form>
    </Card>
  );
}
