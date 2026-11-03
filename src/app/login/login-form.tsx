"use client";

import { useActionState } from "react";
import { login, register, type AuthState } from "./actions";
import { Alert, Field, Spinner, buttonClass, inputClass } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <button className={buttonClass("primary", "lg", "w-full")} disabled={pending}>
        {pending ? <><Spinner /> Signing in…</> : "Sign in"}
      </button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Your name" htmlFor="name">
        <input id="name" name="name" autoComplete="name" required defaultValue={state.name} className={inputClass} />
      </Field>
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className={inputClass} />
      </Field>
      <button className={buttonClass("primary", "lg", "w-full")} disabled={pending}>
        {pending ? <><Spinner /> Creating account…</> : "Create account"}
      </button>
    </form>
  );
}
