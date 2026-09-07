"use server";

import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { updateUserPassword } from "@/lib/users";

export async function resetPasswordAction(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user?.email) {
    return "You must be signed in.";
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.toLowerCase() === "password") {
    return "Choose a password other than the temporary one.";
  }
  if (password !== confirmPassword) {
    return "Passwords don't match.";
  }

  await updateUserPassword(session.user.id, password);

  try {
    await signIn("credentials", { email: session.user.email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Password updated. Please sign in again with your new password.";
    }
    throw error;
  }
}
