"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function loginAction(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  const allowed = await checkRateLimit(`login:${email.toLowerCase()}`, 10, 15 * 60);
  if (!allowed) {
    return "Too many sign-in attempts for this account. Try again in a few minutes.";
  }

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Invalid email or password.";
    }
    throw error;
  }
}
