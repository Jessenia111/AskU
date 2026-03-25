import crypto from "crypto";

export const SESSION_COOKIE = "asku_session";

export function isUtEmail(email: string) {
  const domain = (process.env.ALLOWED_EMAIL_DOMAIN ?? "ut.ee").trim().toLowerCase();
  // If domain is empty — allow all emails
  if (!domain) return email.includes("@") && email.length > 3;
  return email.toLowerCase().endsWith(`@${domain}`);
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
