import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { generatePassword, staffChangeBlocked, type StaffChange, type StaffRole } from "@/lib/staff";
import { ROLE_LABELS } from "@/lib/permissions";
import { audit } from "./audit";
import { ActionError, hashPassword, type CurrentUser } from "./auth";

const OPEN = ["new", "replied", "quoted"] as const;

export async function listStaff() {
  const users = await db.select({ id: s.users.id, name: s.users.name, email: s.users.email, role: s.users.role, active: s.users.active, createdAt: s.users.createdAt }).from(s.users).where(ne(s.users.role, "traveller")).orderBy(s.users.name);
  const open = await db.select({ id: s.enquiries.assignedToId, n: sql<number>`count(*)` }).from(s.enquiries).where(inArray(s.enquiries.status, [...OPEN])).groupBy(s.enquiries.assignedToId);
  const [{ travellers }] = await db.select({ travellers: sql<number>`count(*)` }).from(s.users).where(eq(s.users.role, "traveller"));
  return { staff: users.map((u) => ({ ...u, openEnquiries: open.find((o) => o.id === u.id)?.n ?? 0 })), travellers };
}

async function activeAdmins() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(s.users).where(and(eq(s.users.role, "admin"), eq(s.users.active, true)));
  return n;
}

const oneTimePassword = () => generatePassword((n) => randomBytes(n));

export async function createStaff(input: { name: string; email: string; role: StaffRole }, actor: CurrentUser) {
  const email = input.email.toLowerCase().trim();
  const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email)).limit(1);
  if (exists) throw new ActionError("Someone already uses that email address.");
  const password = oneTimePassword();
  const [u] = await db.insert(s.users).values({ name: input.name.trim(), email, role: input.role, passwordHash: await hashPassword(password) }).returning({ id: s.users.id });
  await audit(actor.id, "user.create", "user", u.id, `Added ${input.name.trim()} as ${ROLE_LABELS[input.role]}`);
  return { password };
}

export async function changeStaff(targetId: string, change: StaffChange, actor: CurrentUser) {
  const [t] = await db.select().from(s.users).where(eq(s.users.id, targetId)).limit(1);
  if (!t) throw new ActionError("User not found.");
  const blocked = staffChangeBlocked(actor.id, t, change, await activeAdmins());
  if (blocked) throw new ActionError(blocked);

  if (change.kind === "role") {
    if (change.role === t.role) return {};
    await db.update(s.users).set({ role: change.role }).where(eq(s.users.id, t.id));
    let released = 0;
    // Editors cannot work enquiries, so anything they held goes back to the pool.
    if (change.role === "editor") released = await releaseEnquiries(t.id, actor, `${t.name} became an editor`);
    await audit(actor.id, "user.role", "user", t.id, `${t.name}: ${ROLE_LABELS[t.role]} → ${ROLE_LABELS[change.role]}`);
    return { released };
  }
  if (change.kind === "active") {
    if (change.active === t.active) return {};
    await db.update(s.users).set({ active: change.active }).where(eq(s.users.id, t.id));
    let released = 0;
    if (!change.active) {
      await db.delete(s.sessions).where(eq(s.sessions.userId, t.id)); // signed out everywhere, now
      released = await releaseEnquiries(t.id, actor, `${t.name} was deactivated`);
    }
    await audit(actor.id, change.active ? "user.activate" : "user.deactivate", "user", t.id, `${change.active ? "Reactivated" : "Deactivated"} ${t.name}`);
    return { released };
  }
  const password = oneTimePassword();
  await db.update(s.users).set({ passwordHash: await hashPassword(password) }).where(eq(s.users.id, t.id));
  await db.delete(s.sessions).where(eq(s.sessions.userId, t.id));
  await audit(actor.id, "user.password", "user", t.id, `Reset the password of ${t.name}`);
  return { password };
}

/** Open enquiries of someone who can no longer work them go back to the unassigned pool. */
async function releaseEnquiries(userId: string, actor: CurrentUser, reason: string) {
  const rows = await db.select({ id: s.enquiries.id }).from(s.enquiries).where(and(eq(s.enquiries.assignedToId, userId), inArray(s.enquiries.status, [...OPEN])));
  if (!rows.length) return 0;
  await db.update(s.enquiries).set({ assignedToId: null }).where(inArray(s.enquiries.id, rows.map((r) => r.id)));
  await db.insert(s.enquiryEvents).values(rows.map((r) => ({ enquiryId: r.id, type: "assign" as const, body: `Returned to the unassigned pool (${reason})`, actorId: actor.id })));
  return rows.length;
}
