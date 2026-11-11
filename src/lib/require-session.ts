import "server-only";
import { auth } from "@/auth";
import { hasDeveloperAccess } from "@/lib/users";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.mustResetPassword) {
    return { session: null, error: Response.json({ error: "Password reset required" }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (session!.user.role !== "admin") {
    return { session: null, error: Response.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { session, error: null };
}

/** For the Developers area: a signed-in user whose developer access is switched on. */
export async function requireDeveloper() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (!(await hasDeveloperAccess(session!.user.id))) {
    return { session: null, error: Response.json({ error: "Developer access required" }, { status: 403 }) };
  }
  return { session, error: null };
}
