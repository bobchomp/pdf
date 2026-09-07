import { Logo } from "@/components/Logo";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-[420px] rounded-[20px] bg-white p-11 shadow-[0_20px_40px_-12px_rgba(15,32,68,0.14),0_4px_12px_rgba(15,32,68,0.06)]">
        <Logo />

        <h1 className="mt-7 text-2xl font-bold tracking-tight text-navy-900">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-gray-600">
          Your password was reset by an admin. Set a new one before continuing.
        </p>

        <ResetPasswordForm />
      </div>
    </div>
  );
}
