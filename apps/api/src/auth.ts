import crypto from "crypto";

export const SESSION_COOKIE = "asku_session";

export function isUtEmail(email: string) {
  const domain = (process.env.ALLOWED_EMAIL_DOMAIN ?? "ut.ee").trim().toLowerCase();
  const parts = email.toLowerCase().trim().split("@");
  // Must have exactly one @, non-empty local part
  if (parts.length !== 2 || parts[0].length === 0) return false;
  if (!domain) return true;
  return parts[1] === domain;
}

export function generateCode6() {
  return String(crypto.randomInt(100000, 1000000));
}

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}
