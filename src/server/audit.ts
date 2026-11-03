import "server-only";
import { db, schema as s } from "@/db";

export async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, summary: string) {
  await db.insert(s.auditLog).values({ actorId, action, entityType, entityId, summary });
}
