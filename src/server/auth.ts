import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { can, type Permission } from "@/lib/permissions";
import type { Role } from "@/db/schema";

const COOKIE = "kayal_session";
const SESSION_DAYS = 14;

export type CurrentUser = { id: string; name: string; email: string; role: Role };

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(s.sessions).values({ id: sha256(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(s.sessions).where(eq(s.sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** Reads the session cookie once per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: s.users.id, name: s.users.name, email: s.users.email, role: s.users.role })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .where(and(eq(s.sessions.id, sha256(token)), gt(s.sessions.expiresAt, new Date()), eq(s.users.active, true)))
    .limit(1);
  return rows[0] ?? null;
});

/** For pages: sends anonymous users to sign in and staff without access to the dashboard. */
export async function requireUser(permission?: Permission, next = "/admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (permission && !can(user.role, permission)) redirect(user.role === "traveller" ? "/account" : "/admin?denied=1");
  return user;
}

export class ActionError extends Error {}

/** For server actions and route handlers: throws instead of redirecting. */
export async function authorize(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("Your session has ended. Please sign in again.");
  if (!can(user.role, permission)) throw new ActionError("You don't have permission to do that.");
  return user;
}

// Simple in-memory brute-force guard: 5 failures per email+IP per 15 minutes.
// Per-instance only; a shared store (e.g. Redis) would be needed with several servers.
const attempts = new Map<string, { count: number; until: number }>();
export function loginBlocked(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.count >= 5 && a.until > Date.now();
}
export function recordLoginFailure(key: string) {
  const a = attempts.get(key);
  const fresh = !a || a.until < Date.now();
  attempts.set(key, { count: fresh ? 1 : a!.count + 1, until: Date.now() + 15 * 60_000 });
}
export function clearLoginFailures(key: string) {
  attempts.delete(key);
}

let dummyHash: string | undefined;

export async function verifyLogin(email: string, password: string) {
  const [user] = await db.select().from(s.users).where(eq(s.users.email, email.toLowerCase().trim())).limit(1);
  // Compare against a dummy hash when the user doesn't exist, so timing doesn't reveal accounts.
  dummyHash ??= await bcrypt.hash("not-a-real-password", 10);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !ok || !user.active) return null;
  return user;
}
