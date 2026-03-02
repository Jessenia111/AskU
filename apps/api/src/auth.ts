import crypto from "crypto";

export const SESSION_COOKIE = "asku_session";

export function isUtEmail(email: string) {
  return email.toLowerCase().endsWith("@ut.ee");
}

export function generateCode6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}
