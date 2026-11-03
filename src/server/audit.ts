import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";

export async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, summary: string) {
  await db.insert(s.auditLog).values({ actorId, action, entityType, entityId, summary });
}

/** Who last did one of these actions to an entity, for conflict messages. */
export async function lastActor(entityId: string, actions: string[]) {
  const [row] = await db
    .select({ name: s.users.name, at: s.auditLog.createdAt })
    .from(s.auditLog)
    .leftJoin(s.users, eq(s.users.id, s.auditLog.actorId))
    .where(and(eq(s.auditLog.entityId, entityId), inArray(s.auditLog.action, actions)))
    .orderBy(desc(s.auditLog.createdAt))
    .limit(1);
  return { by: row?.name ?? "Someone", at: row?.at ?? new Date() };
}
