import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/Reveal";

/** One dashboard section: a numbered kicker, a heading, an optional intro and aside, then the content. */
export function Section({
  id,
  n,
  kicker,
  title,
  intro,
  aside,
  children,
}: {
  id: string;
  n: string;
  kicker: string;
  title: string;
  intro?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-line py-14 md:py-20">
      <Reveal y={16}>
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div className="min-w-0">
            <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              <span className="tabular font-mono tracking-normal text-ink">{n}</span>
              <span className="h-px w-6 bg-line" aria-hidden />
              {kicker}
            </p>
            <h2
              id={`${id}-title`}
              className="mt-4 max-w-[22ch] text-balance text-[clamp(1.75rem,3.2vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.03em]"
            >
              {title}
            </h2>
            {intro && <p className="mt-3 max-w-[62ch] text-pretty leading-relaxed text-muted">{intro}</p>}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
      </Reveal>
      <div className="mt-10">{children}</div>
    </section>
  );
}
