import "server-only";
import crypto from "node:crypto";

const SECRET = process.env.AUTH_SECRET ?? "";

function sign(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

function passwordFingerprint(passwordHash: string) {
  return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

/**
 * A signed, time-limited "forgot password" link — no database table needed. Binding it to a
 * fingerprint of the CURRENT password hash makes it self-invalidating: once the password
 * changes, by this link or any other means, the fingerprint baked into older links no longer
 * matches and they stop working.
 */
export function createPasswordResetToken(user: { id: string; passwordHash: string }, expiresInSeconds = 60 * 60) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const fingerprint = passwordFingerprint(user.passwordHash);
  const payload = `${user.id}.${expiresAt}.${fingerprint}`;
  return `${payload}.${sign(payload)}`;
}

/** Reads the user id out of a token without yet trusting it, so the caller can look that user up. */
export function decodeUserIdFromToken(token: string): string | null {
  const [userId] = token.split(".");
  return userId || null;
}

export function verifyPasswordResetToken(token: string, user: { id: string; passwordHash: string } | null): boolean {
  if (!user) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [userId, expiresAtRaw, fingerprint, signature] = parts;
  if (userId !== user.id) return false;

  const payload = `${userId}.${expiresAtRaw}.${fingerprint}`;
  const expected = sign(payload);
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return false;

  return fingerprint === passwordFingerprint(user.passwordHash);
}
