import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-[420px] rounded-[20px] bg-white p-11 shadow-[0_20px_40px_-12px_rgba(15,32,68,0.14),0_4px_12px_rgba(15,32,68,0.06)]">
        <Logo />

        <h1 className="mt-7 text-2xl font-bold tracking-tight text-navy-900">Sign in</h1>
        <p className="mt-1.5 text-sm text-gray-600">Access your flipbook dashboard.</p>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 border-t border-gray-100 pt-5 text-xs leading-relaxed text-gray-400">
          Accounts are created by an admin. Ask them to add you from the Team page.
        </p>
      </div>
    </div>
  );
}
