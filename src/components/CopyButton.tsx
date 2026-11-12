"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-[9px] bg-navy-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-navy-700"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
