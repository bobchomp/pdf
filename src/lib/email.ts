import "server-only";
import { Resend } from "resend";

const API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const BRAND_NAME = "Smithton Church Newsletter";

let client: Resend | null = null;

function resendClient() {
  if (!API_KEY) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL. See SETUP.md.");
  }
  if (!client) client = new Resend(API_KEY);
  return client;
}

/**
 * Table-based layout with every style inline — mirrors the app's navy/blue palette
 * (see globals.css), but email clients (Outlook especially) don't reliably support
 * <style> blocks, flexbox/grid, or web fonts, so this sticks to what renders everywhere.
 */
function passwordResetEmailHtml(resetUrl: string) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f2f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f4f7;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:480px;background-color:#ffffff;border-radius:16px;">
            <tr>
              <td style="padding:40px 40px 0 40px;">
                <span style="font-size:17px;font-weight:700;color:#0f2044;">${BRAND_NAME}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <span style="font-size:22px;font-weight:700;color:#0f2044;">Reset your password</span>
                <p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#384250;">
                  We received a request to reset your password. Click the button below to choose
                  a new one — this link expires in 1 hour.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:9px;background-color:#0f2044;">
                      <a
                        href="${resetUrl}"
                        style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;"
                      >
                        Set a new password
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <p style="margin:0;font-size:12.5px;line-height:1.6;color:#8a94a6;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin:6px 0 0 0;font-size:12.5px;line-height:1.6;word-break:break-all;">
                  <a href="${resetUrl}" style="color:#2f6fed;">${resetUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 40px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e7ec;">
                  <tr>
                    <td style="padding-top:20px;">
                      <p style="margin:0;font-size:12.5px;line-height:1.6;color:#8a94a6;">
                        If you didn't request this, you can safely ignore this email — your
                        password won't change.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function passwordResetEmailText(resetUrl: string) {
  return [
    "We received a request to reset your password.",
    "",
    `Set a new password: ${resetUrl}`,
    "",
    "This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.",
  ].join("\n");
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL is not set. See SETUP.md.");
  }

  const { error } = await resendClient().emails.send({
    from: `${BRAND_NAME} <${FROM_EMAIL}>`,
    to,
    subject: "Reset your password",
    html: passwordResetEmailHtml(resetUrl),
    text: passwordResetEmailText(resetUrl),
  });

  if (error) {
    throw new Error(error.message);
  }
}
