import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nano = customAlphabet(alphabet, 12);
const slugNano = customAlphabet(alphabet, 8);

export function newId(prefix: string) {
  return `${prefix}_${nano()}`;
}

export function newSlug(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "flipbook"}-${slugNano()}`;
}
