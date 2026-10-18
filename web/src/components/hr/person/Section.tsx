import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/Reveal";

/** One numbered block of the person page: mono index, heading, optional note on the right. */
export function Section({
  n,
  id,
  title,
  aside,
  children,
  className = "",
}: {
  n: number;
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={`min-w-0 ${className}`}>
      <Reveal y={16}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-line pt-5">
          <div className="flex items-baseline gap-4">
            <span className="tabular font-mono text-xs text-muted">{`//${String(n).padStart(2, "0")}`}</span>
            <h2 id={`${id}-title`} className="text-[clamp(1.375rem,2.2vw,1.875rem)] font-semibold leading-tight tracking-[-0.025em]">
              {title}
            </h2>
          </div>
          {aside && <div className="text-sm text-muted">{aside}</div>}
        </div>
        <div className="mt-8">{children}</div>
      </Reveal>
    </section>
  );
}
