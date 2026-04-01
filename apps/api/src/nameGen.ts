import crypto from "crypto";

const ADJECTIVES = [
  "Swift", "Brave", "Calm", "Wise", "Kind",
  "Bold", "Keen", "Warm", "Cool", "Bright",
  "Quiet", "Sharp", "Soft", "Wild", "Proud",
  "Clever", "Gentle", "Fierce", "Lucky", "Nimble",
];

const NOUNS = [
  "Owl", "Fox", "Bear", "Deer", "Wolf",
  "Hawk", "Lynx", "Hare", "Seal", "Crow",
  "Mole", "Elk", "Ibis", "Kite", "Lark",
  "Finch", "Puma", "Teal", "Wren", "Dove",
];

export function generatePseudonymName(): string {
  const adj = ADJECTIVES[crypto.randomInt(0, ADJECTIVES.length)];
  const noun = NOUNS[crypto.randomInt(0, NOUNS.length)];
  const num = crypto.randomInt(100, 1000);
  return `${adj}${noun}${num}`;
}

/** Derives a display name from an email address.
 *  e.g. jessenia.tsenkman@ut.ee  →  "Jessenia Tsenkman"
 *       john@ut.ee               →  "John"
 */
export function deriveRealName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const parts = local.split(".").filter(Boolean).slice(0, 2);
  return parts.map(capitalize).join(" ") || local;
}
