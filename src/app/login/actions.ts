"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { clearLoginFailures, createSession, destroySession, hashPassword, loginBlocked, recordLoginFailure, verifyLogin } from "@/server/auth";
import { audit } from "@/server/audit";

export type AuthState = { error?: string; email?: string; name?: string };

function safeNext(next: unknown, role: string) {
  const fallback = role === "traveller" ? "/account" : "/admin";
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (role === "traveller" && next.startsWith("/admin")) return "/account";
  return next;
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = `${email}|${ip}`;
  if (loginBlocked(key)) return { error: "Too many attempts. Please wait 15 minutes and try again.", email };
  const user = await verifyLogin(email, password);
  if (!user) {
    recordLoginFailure(key);
    return { error: "That email and password don't match.", email };
  }
  clearLoginFailures(key);
  await createSession(user.id);
  if (user.role !== "traveller") await audit(user.id, "auth.login", "user", user.id, `${user.name} signed in`);
  redirect(safeNext(form.get("next"), user.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(200),
});

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  const name = String(form.get("name") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email, name };
  const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, parsed.data.email)).limit(1);
  if (exists) return { error: "An account with that email already exists. Sign in instead.", email, name };
  // New sign-ups are always travellers; staff accounts are created by an admin.
  const [user] = await db.insert(s.users).values({ name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), role: "traveller" }).returning();
  await createSession(user.id);
  redirect("/account");
}
