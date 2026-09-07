"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { getUserById, updateUserPassword } from "@/lib/users";
import { decodeUserIdFromToken, verifyPasswordResetToken } from "@/lib/password-reset-token";

export async function confirmResetAction(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const userId = decodeUserIdFromToken(token);
  const user = userId ? await getUserById(userId) : null;
  if (!user || !verifyPasswordResetToken(token, user)) {
    return "This reset link is invalid or has expired. Request a new one from the login page.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password !== confirmPassword) {
    return "Passwords don't match.";
  }

  await updateUserPassword(user.id, password);

  try {
    await signIn("credentials", { email: user.email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Password updated. Please sign in with your new password.";
    }
    throw error;
  }
}
