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
