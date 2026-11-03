import { describe, expect, it } from "vitest";
import { generatePassword, staffChangeBlocked } from "./staff";

const admin = { id: "a1", role: "admin" as const, active: true };
const editor = { id: "e1", role: "editor" as const, active: true };

describe("staffChangeBlocked", () => {
  it("lets an admin change other people", () => {
    expect(staffChangeBlocked("a1", editor, { kind: "role", role: "consultant" }, 1)).toBeNull();
    expect(staffChangeBlocked("a1", editor, { kind: "active", active: false }, 1)).toBeNull();
  });
  it("stops admins locking themselves out", () => {
    expect(staffChangeBlocked("a1", admin, { kind: "active", active: false }, 3)).toMatch(/your own account/);
    expect(staffChangeBlocked("a1", admin, { kind: "role", role: "editor" }, 3)).toMatch(/own admin rights/);
  });
  it("always keeps one active admin", () => {
    const other = { id: "a2", role: "admin" as const, active: true };
    expect(staffChangeBlocked("a1", other, { kind: "active", active: false }, 1)).toMatch(/at least one active admin/);
    expect(staffChangeBlocked("a1", other, { kind: "active", active: false }, 2)).toBeNull();
  });
  it("leaves traveller accounts alone", () => {
    expect(staffChangeBlocked("a1", { id: "t", role: "traveller", active: true }, { kind: "password" }, 1)).toMatch(/Traveller/);
  });
});

describe("generatePassword", () => {
  it("makes four readable groups without look-alike characters", () => {
    const p = generatePassword((n) => Uint8Array.from({ length: n }, (_, i) => i * 7));
    expect(p).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(p).not.toMatch(/[ilo01]/);
  });
});
