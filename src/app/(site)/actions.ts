"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { createEnquiry } from "@/server/enquiries";
import { getCurrentUser } from "@/server/auth";

const optional = <T extends z.ZodTypeAny>(t: T) => z.union([t, z.literal("")]).optional();

const enquirySchema = z.object({
  name: z.string().trim().min(2, "Please tell us your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
  phone: optional(z.string().trim().max(20).regex(/^\+?[\d\s()-]{8,20}$/, "Enter a phone number with country code, e.g. +91 98470 12345")),
  date: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => d >= new Date().toISOString().slice(0, 10), "Pick a date in the future")),
  adults: z.coerce.number().int().min(1, "At least one adult").max(60),
  children: z.coerce.number().int().min(0).max(30),
  message: z.string().trim().min(10, "Tell us a little about the trip you have in mind").max(3000),
  packageId: optional(z.string().uuid()),
  consent: z.literal("on", { message: "Please agree so we can reply to you" }),
  whatsapp: z.literal("on").optional(),
  website: z.string().max(0).optional(), // honeypot: real people never see this field
});

export type EnquiryFormState = { errors?: Record<string, string>; formError?: string; values?: Record<string, string> };

const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  recent.set(ip, list);
  return list.length > 5;
}

export async function submitEnquiry(_: EnquiryFormState, formData: FormData): Promise<EnquiryFormState> {
  const raw = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = enquirySchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    if (errors.website) return { formError: "Something went wrong. Please try again.", values: raw };
    return { errors, values: raw };
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (tooMany(ip)) return { formError: "You have sent several enquiries in the last few minutes. Please wait a little, or call us.", values: raw };

  const v = parsed.data;
  let packageId: string | null = null;
  if (v.packageId) {
    const [p] = await db.select({ id: s.packages.id }).from(s.packages).where(eq(s.packages.id, v.packageId)).limit(1);
    packageId = p?.id ?? null;
  }
  const user = await getCurrentUser();
  let ref: string;
  try {
    const res = await createEnquiry(
      {
        channel: "web", name: v.name, email: v.email, phone: v.phone || null, message: v.message, packageId,
        formDate: v.date || null, formAdults: v.adults, formChildren: v.children,
        consentContact: true, consentWhatsapp: v.whatsapp === "on" && !!v.phone, travellerId: user?.role === "traveller" ? user.id : null,
      },
      null,
    );
    ref = res.ref;
  } catch (e) {
    console.error("enquiry failed", e);
    return { formError: "We could not save your enquiry. Please try again in a moment.", values: raw };
  }
  redirect(`/enquire/thanks?ref=${encodeURIComponent(ref)}`);
}
