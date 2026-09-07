"use client";

import { useActionState } from "react";
import { requestResetAction, type RequestResetState } from "./actions";

const inputClass =
  "mt-1.5 w-full rounded-[10px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100";

const initialState: RequestResetState = { error: null, sent: false };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, initialState);

  if (state.sent) {
    return (
      <p className="mt-7 text-sm leading-relaxed text-gray-700">
        If an account exists for that email, we&apos;ve sent a link to reset your password. Check your inbox.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-7 space-y-4">
      <div>
        <label htmlFor="email" className="block text-[13px] font-semibold text-gray-700">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" autoFocus className={inputClass} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[10px] bg-navy-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
