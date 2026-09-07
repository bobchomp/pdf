"use client";

import { useActionState } from "react";
import { confirmResetAction } from "./actions";

const inputClass =
  "mt-1.5 w-full rounded-[10px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100";

export function ConfirmResetForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(confirmResetAction, undefined);

  return (
    <form action={formAction} className="mt-7 space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="block text-[13px] font-semibold text-gray-700">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          autoFocus
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-[13px] font-semibold text-gray-700">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[10px] bg-navy-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
