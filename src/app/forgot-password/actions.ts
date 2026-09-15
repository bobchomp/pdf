"use server";

import { getUserByEmail } from "@/lib/users";
import { createPasswordResetToken } from "@/lib/password-reset-token";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

export type RequestResetState = { error: string | null; sent: boolean };

export async function requestResetAction(_prevState: RequestResetState, formData: FormData): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter your email address.", sent: false };
  }

  // A missing NEXTAUTH_URL is a server misconfiguration, not something specific to this email —
  // checked unconditionally, before the lookup, so it fails loudly instead of silently mailing
  // out broken localhost links.
  const origin = process.env.NEXTAUTH_URL;
  if (!origin) {
    return { error: "Password reset isn't configured on this server yet. Contact an admin.", sent: false };
  }

  // Checked before the lookup, and keyed on the raw email either way, so the response an
  // attacker sees doesn't depend on whether the account actually exists.
  const allowed = await checkRateLimit(`forgot:${email.toLowerCase()}`, 3, 60 * 60);
  if (!allowed) {
    return { error: "Too many requests for this email. Try again in a bit.", sent: false };
  }

  const user = await getUserByEmail(email);
  if (user) {
    const token = createPasswordResetToken(user);
    const resetUrl = `${origin}/reset-password/confirm?token=${encodeURIComponent(token)}`;
    // Never let a delivery failure (or the lack of a matching account) show through to the
    // response — the UI always reports success either way, so no one can probe which emails
    // have accounts.
    await sendPasswordResetEmail(user.email, resetUrl).catch(() => {});
  }

  return { error: null, sent: true };
}
