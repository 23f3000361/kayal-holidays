import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [m] = await db.select({ bytes: s.media.bytes, mime: s.media.mime }).from(s.media).where(eq(s.media.id, id)).limit(1);
  if (!m) return new Response("Not found", { status: 404 });
  // Media rows are immutable, so they can be cached for a year.
  return new Response(new Uint8Array(m.bytes), { headers: { "Content-Type": m.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
