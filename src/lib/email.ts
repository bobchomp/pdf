import "server-only";
import { Resend } from "resend";

const API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

let client: Resend | null = null;

function resendClient() {
  if (!API_KEY) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL. See SETUP.md.");
  }
  if (!client) client = new Resend(API_KEY);
  return client;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL is not set. See SETUP.md.");
  }

  const { error } = await resendClient().emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Reset your password",
    html: `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a>. This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}
