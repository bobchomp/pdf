import "server-only";
import crypto from "node:crypto";

const SECRET = process.env.AUTH_SECRET ?? "";

function sign(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

/** Token proving a visitor supplied the correct password for a private flipbook. */
export function createFlipbookAccessToken(flipbookId: string, expiresInSeconds = 60 * 60 * 12) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const payload = `${flipbookId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyFlipbookAccessToken(flipbookId: string, token: string | undefined | null) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenFlipbookId, expiresAtRaw, signature] = parts;
  if (tokenFlipbookId !== flipbookId) return false;

  const payload = `${tokenFlipbookId}.${expiresAtRaw}`;
  const expected = sign(payload);
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

export function flipbookAccessCookieName(flipbookId: string) {
  return `fb_access_${flipbookId}`;
}
