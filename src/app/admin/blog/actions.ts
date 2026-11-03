"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize, ActionError } from "@/server/auth";
import * as blog from "@/server/blog";
import { getLivePackages } from "@/server/packages";
import { suggestRelated } from "@/lib/blog";
import type { ActionResult } from "@/app/admin/actions";

const uuid = z.string().uuid();

async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message };
  } catch (e) {
    if (e instanceof ActionError || e instanceof z.ZodError) return { ok: false, error: e instanceof z.ZodError ? e.issues[0].message : e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Nothing was changed. Please try again." };
  }
}

export async function createPostAction(_: unknown, form: FormData): Promise<ActionResult> {
  const user = await authorize("blog.edit");
  const title = z.string().trim().min(3, "Give the post a working title").max(140).safeParse(form.get("title"));
  if (!title.success) return { ok: false, error: title.error.issues[0].message };
  const id = await blog.createPost(title.data, user);
  revalidatePath("/admin/blog");
  redirect(`/admin/blog/${id}`);
}

export async function savePostAction(id: string, content: unknown): Promise<ActionResult> {
  const user = await authorize("blog.edit");
  const r = await blog.savePostDraft(uuid.parse(id), content, user);
  if (!r.ok) return { ok: false, error: "Some fields need attention.", fieldErrors: r.errors };
  revalidatePath(`/admin/blog/${id}`);
  revalidatePath("/admin/blog");
  return { ok: true, message: "Draft saved" };
}

export async function publishPostAction(id: string, publishAt?: string) {
  return run(async () => {
    const user = await authorize("blog.edit");
    const when = publishAt ? new Date(publishAt) : undefined;
    if (when && Number.isNaN(when.getTime())) throw new ActionError("That date and time is not valid.");
    const r = await blog.publishPost(uuid.parse(id), when, user);
    revalidatePath(`/admin/blog/${id}`);
    revalidatePath("/admin/blog");
    return { scheduled: r.scheduled, when: r.when.toISOString() };
  });
}

export async function unpublishPostAction(id: string) {
  return run(async () => {
    const user = await authorize("blog.edit");
    await blog.unpublishPost(uuid.parse(id), user);
    revalidatePath(`/admin/blog/${id}`);
    revalidatePath("/admin/blog");
  }, "Taken off the site");
}

export async function postSlugAction(id: string, slug: string) {
  return run(async () => {
    const user = await authorize("blog.edit");
    await blog.updatePostSlug(uuid.parse(id), z.string().max(80).parse(slug), user);
    revalidatePath(`/admin/blog/${id}`);
  }, "Address saved");
}

/** Suggests related packages from the post's text (the inbox's matching engine, run on prose). */
export async function suggestRelatedAction(input: { title: string; body: string }) {
  return run(async () => {
    await authorize("blog.edit");
    const v = z.object({ title: z.string().max(140), body: z.string().max(40_000) }).parse(input);
    const live = await getLivePackages();
    return suggestRelated(v, live.map((p) => ({ id: p.id, code: p.code, slug: p.slug, content: p.content }))).map((s) => ({ slug: s.slug, title: s.title, score: s.score, why: s.parts.filter((x) => x.points > 0 && x.label !== "Length" && x.label !== "Budget").map((x) => x.detail).join("; ") }));
  });
}
