"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitEnquiry, type EnquiryFormState } from "@/app/(site)/actions";
import { Alert, Field, Spinner, buttonClass, inputClass, cx } from "@/components/ui";

export function EnquiryForm({ packageSlug, packageTitle, disabled }: { packageSlug?: string; packageTitle?: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<EnquiryFormState, FormData>(submitEnquiry, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  const today = new Date().toISOString().slice(0, 10);
  const err = (k: string) => ({ "aria-invalid": !!e[k] || undefined, "aria-describedby": e[k] ? `${k}-error` : undefined });

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.formError && <Alert tone="danger">{state.formError}</Alert>}
      {disabled && <Alert tone="info">This is a preview. The form is switched off until the package is published.</Alert>}
      {packageSlug && <input type="hidden" name="package" value={packageSlug} />}
      <div className="hidden" aria-hidden>
        <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" error={e.name}>
          <input id="name" name="name" autoComplete="name" defaultValue={v.name} className={inputClass} required {...err("name")} />
        </Field>
        <Field label="Email" htmlFor="email" error={e.email}>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={v.email} className={inputClass} required {...err("email")} />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone" error={e.phone} hint="With country code, if you'd like a call or WhatsApp">
          <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91" defaultValue={v.phone} className={inputClass} {...err("phone")} />
        </Field>
        <Field label="Start date (optional)" htmlFor="date" error={e.date} hint="Leave empty if you're flexible">
          <input id="date" name="date" type="date" min={today} defaultValue={v.date} className={inputClass} {...err("date")} />
        </Field>
        <Field label="Adults" htmlFor="adults" error={e.adults}>
          <input id="adults" name="adults" type="number" min={1} max={60} defaultValue={v.adults ?? "2"} className={inputClass} {...err("adults")} />
        </Field>
        <Field label="Children (under 12)" htmlFor="children" error={e.children}>
          <input id="children" name="children" type="number" min={0} max={30} defaultValue={v.children ?? "0"} className={inputClass} {...err("children")} />
        </Field>
      </div>

      <Field label="About your trip" htmlFor="message" error={e.message} hint="Dates, how many nights, budget, anything that matters to you. Write it however you like.">
        <textarea
          id="message"
          name="message"
          rows={4}
          defaultValue={v.message}
          placeholder={packageTitle ? `e.g. We'd like ${packageTitle} in December, around 1.2 lakh in total, with a houseboat night.` : "e.g. 2 adults and 1 child, Kerala for 5–6 nights in December, budget around 1.2 lakh, houseboat a must"}
          className={cx(inputClass, "resize-y")}
          {...err("message")}
        />
      </Field>

      <div className="space-y-3 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent" defaultChecked={v.consent === "on"} className="mt-0.5 size-4 accent-[var(--color-accent)]" {...err("consent")} />
          <span className="text-ink-2">
            I agree that Kayal Holidays may use these details to reply to this enquiry. <Link href="/privacy" className="underline underline-offset-2">How we use your data</Link>
          </span>
        </label>
        {e.consent && <p className="pl-7 text-danger" id="consent-error">{e.consent}</p>}
        <label className="flex items-start gap-3">
          <input type="checkbox" name="whatsapp" defaultChecked={v.whatsapp === "on"} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
          <span className="text-ink-2">You may also follow up on WhatsApp (optional, needs a phone number)</span>
        </label>
      </div>

      <button type="submit" disabled={pending || disabled} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
        {pending ? <><Spinner /> Sending…</> : "Send enquiry"}
      </button>
    </form>
  );
}
