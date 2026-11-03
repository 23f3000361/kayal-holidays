import type { Role } from "./constants";

export const STAFF_ROLES = ["admin", "editor", "consultant"] as const satisfies readonly Role[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffChange = { kind: "role"; role: StaffRole } | { kind: "active"; active: boolean } | { kind: "password" };
type Target = { id: string; role: Role; active: boolean };

/**
 * Rules that keep the team from locking itself out. Returns a reason, or null if allowed.
 * `activeAdmins` is the number of active admins before the change.
 */
export function staffChangeBlocked(actorId: string, target: Target, change: StaffChange, activeAdmins: number): string | null {
  if (target.role === "traveller") return "Traveller accounts are managed by the travellers themselves.";
  const self = actorId === target.id;
  const losesAdmin = target.role === "admin" && target.active && ((change.kind === "role" && change.role !== "admin") || (change.kind === "active" && !change.active));
  if (self && change.kind === "active" && !change.active) return "You can't deactivate your own account.";
  if (self && change.kind === "role" && change.role !== "admin") return "You can't remove your own admin rights. Ask another admin.";
  if (losesAdmin && activeAdmins <= 1) return "There must always be at least one active admin.";
  return null;
}

/** Readable one-time password: 4 groups of 4 from an alphabet without look-alike characters. */
export function generatePassword(random: (n: number) => Uint8Array): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = random(16);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}
