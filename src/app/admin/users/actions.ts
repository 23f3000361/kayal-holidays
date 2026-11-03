"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize, ActionError } from "@/server/auth";
import { changeStaff, createStaff } from "@/server/users";
import { STAFF_ROLES } from "@/lib/staff";
import type { ActionResult } from "@/app/admin/actions";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/admin/users");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ActionError || e instanceof z.ZodError) return { ok: false, error: e instanceof z.ZodError ? e.issues[0].message : e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

const uuid = z.string().uuid();

export async function createStaffAction(input: { name: string; email: string; role: string }) {
  return run(async () => {
    const actor = await authorize("users.manage");
    const v = z.object({ name: z.string().trim().min(2, "Enter a name").max(80), email: z.string().trim().email("Enter a valid email").max(120), role: z.enum(STAFF_ROLES) }).parse(input);
    return createStaff(v, actor);
  });
}

export async function setRoleAction(id: string, role: string) {
  return run(async () => changeStaff(uuid.parse(id), { kind: "role", role: z.enum(STAFF_ROLES).parse(role) }, await authorize("users.manage")));
}

export async function setActiveAction(id: string, active: boolean) {
  return run(async () => changeStaff(uuid.parse(id), { kind: "active", active: z.boolean().parse(active) }, await authorize("users.manage")));
}

export async function resetPasswordAction(id: string) {
  return run(async () => changeStaff(uuid.parse(id), { kind: "password" }, await authorize("users.manage")));
}
