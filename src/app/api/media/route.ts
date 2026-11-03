import { NextResponse } from "next/server";
import { db, schema as s } from "@/db";
import { authorize, ActionError } from "@/server/auth";
import { audit } from "@/server/audit";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/webp", "image/jpeg", "image/png"];

/** Magic-number check, so a renamed file can't pose as an image. */
function sniff(b: Buffer): string | null {
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

export async function POST(req: Request) {
  try {
    const user = await authorize("media.upload");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is larger than 2 MB after resizing." }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = sniff(bytes);
    if (!mime || !TYPES.includes(mime)) return NextResponse.json({ error: "Only JPEG, PNG or WebP photos can be uploaded." }, { status: 415 });
    const width = Math.min(10000, Math.max(1, Number(form.get("width")) || 1));
    const height = Math.min(10000, Math.max(1, Number(form.get("height")) || 1));
    const [row] = await db.insert(s.media).values({ filename: file.name.slice(0, 120), mime, width, height, bytes, uploadedById: user.id }).returning({ id: s.media.id });
    await audit(user.id, "media.upload", "media", row.id, `Uploaded ${file.name.slice(0, 80)}`);
    return NextResponse.json({ src: `/media/${row.id}` });
  } catch (e) {
    if (e instanceof ActionError) return NextResponse.json({ error: e.message }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
