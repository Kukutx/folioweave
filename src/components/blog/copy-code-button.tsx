"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Check, Copy } from "lucide-react";

/** Copies the code block it sits next to. */
export function CopyCodeButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(event: MouseEvent<HTMLButtonElement>) {
    const code = event.currentTarget.parentElement?.querySelector("pre");
    if (!code) return;
    try {
      // Without the block's closing line break, a pasted command waits for
      // the reader to run it.
      await navigator.clipboard.writeText((code.textContent ?? "").replace(/\n$/, ""));
      setCopied(true);
    } catch {
      // No clipboard access (insecure origin or denied permission): select the
      // code so the reader's own copy shortcut finishes the job.
      window.getSelection()?.selectAllChildren(code);
    }
  }

  return (
    <button type="button" className="code-copy-button" onClick={copy}>
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
