import type { ReactNode } from "react";

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-soft">
      {children}
    </span>
  );
}
