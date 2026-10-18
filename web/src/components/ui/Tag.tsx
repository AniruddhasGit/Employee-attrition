import type { ReactNode } from "react";

/** Quiet pill label. `icon` is optional and sits before the text. */
export function Tag({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-sm text-ink-soft">
      {icon && (
        <span aria-hidden className="text-muted">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
