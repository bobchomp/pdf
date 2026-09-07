import { Logo } from "@/components/Logo";
import { ConfirmResetForm } from "./confirm-reset-form";

export default async function ConfirmResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-[420px] rounded-[20px] bg-white p-11 shadow-[0_20px_40px_-12px_rgba(15,32,68,0.14),0_4px_12px_rgba(15,32,68,0.06)]">
        <Logo />

        <h1 className="mt-7 text-2xl font-bold tracking-tight text-navy-900">Choose a new password</h1>

        {token ? (
          <>
            <p className="mt-1.5 text-sm text-gray-600">Set a new password for your account.</p>
            <ConfirmResetForm token={token} />
          </>
        ) : (
          <p className="mt-1.5 text-sm text-red-600">
            This link is missing its reset token. Request a new one from the login page.
          </p>
        )}
      </div>
    </div>
  );
}
