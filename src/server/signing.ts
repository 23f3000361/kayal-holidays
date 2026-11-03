import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET must be set (32+ characters)");
    return "development-only-secret-do-not-use-in-production";
  }
  return s;
}

/** Signed, expiring link so the MD can review a draft without an account. */
export function signPreview(packageId: string, days = 7) {
  const exp = Date.now() + days * 86_400_000;
  const sig = createHmac("sha256", secret()).update(`preview:${packageId}:${exp}`).digest("base64url");
  return { exp, sig };
}

export function verifyPreview(packageId: string, exp: string | undefined, sig: string | undefined) {
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = createHmac("sha256", secret()).update(`preview:${packageId}:${exp}`).digest();
  const given = Buffer.from(sig, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
