import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createEnquiry } from "@/server/enquiries";

/**
 * Simulated inbound channel. In production a WhatsApp Business provider or an email
 * forwarding service would POST here; for the demo it is called with curl.
 * Requires the INBOUND_SECRET header so nobody else can inject enquiries.
 */
const body = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  message: z.string().trim().min(2).max(5000),
  whatsappConsent: z.boolean().optional(),
});

function secretOk(given: string | null) {
  const expected = process.env.INBOUND_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  if (!["whatsapp", "email", "chat"].includes(channel)) return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
  if (!secretOk(req.headers.get("x-inbound-secret"))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const v = parsed.data;
  if (!v.email && !v.phone) return NextResponse.json({ error: "email or phone is required" }, { status: 400 });
  // A WhatsApp message is itself an opt-in to reply on WhatsApp for that conversation.
  const consent = channel === "whatsapp" ? true : !!v.whatsappConsent;
  const r = await createEnquiry({ channel: channel as "whatsapp" | "email" | "chat", name: v.name, email: v.email ?? null, phone: v.phone ?? null, message: v.message, consentContact: true, consentWhatsapp: consent && !!v.phone }, null);
  return NextResponse.json({ ref: r.ref }, { status: 201 });
}
