import type { Role } from "@/lib/constants";

/** Single source of truth for who may do what. Checked on the server for every action. */
export const PERMISSIONS = {
  "admin.access": ["admin", "editor", "consultant"],
  "packages.view": ["admin", "editor", "consultant"],
  "packages.edit": ["admin", "editor"],
  "packages.publish": ["admin", "editor"],
  "media.upload": ["admin", "editor"],
  "enquiries.view": ["admin", "consultant"],
  "enquiries.viewAll": ["admin"],
  "enquiries.work": ["admin", "consultant"],
  "enquiries.assign": ["admin"],
  "enquiries.log": ["admin", "consultant"],
  "quotes.create": ["admin", "consultant"],
  "audit.view": ["admin"],
  "users.manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Consultants see their own enquiries and the unassigned pool; admins see everything. */
export function canSeeEnquiry(user: { id: string; role: Role }, enquiry: { assignedToId: string | null }): boolean {
  if (can(user.role, "enquiries.viewAll")) return true;
  if (!can(user.role, "enquiries.view")) return false;
  return enquiry.assignedToId === null || enquiry.assignedToId === user.id;
}

export const ROLE_LABELS: Record<Role, string> = { admin: "Admin", editor: "Content editor", consultant: "Travel consultant", traveller: "Traveller" };
