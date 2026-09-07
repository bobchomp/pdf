import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-[420px] rounded-[20px] bg-white p-11 shadow-[0_20px_40px_-12px_rgba(15,32,68,0.14),0_4px_12px_rgba(15,32,68,0.06)]">
        <Logo />

        <h1 className="mt-7 text-2xl font-bold tracking-tight text-navy-900">Reset your password</h1>
        <p className="mt-1.5 text-sm text-gray-600">Enter your email and we&apos;ll send you a link to set a new one.</p>

        <ForgotPasswordForm />

        <p className="mt-6 border-t border-gray-100 pt-5 text-xs text-gray-400">
          <Link href="/login" className="font-semibold text-blue-600 hover:text-navy-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
