import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nano = customAlphabet(alphabet, 12);
const slugNano = customAlphabet(alphabet, 8);

export function newId(prefix: string) {
  return `${prefix}_${nano()}`;
}

export function newSlug() {
  return slugNano();
}
