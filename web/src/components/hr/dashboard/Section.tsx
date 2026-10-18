import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/Reveal";

/** One dashboard section: a numbered eyebrow, a heading, an optional intro, then the content. */
export function Section({
  id,
  n,
  title,
  intro,
  aside,
  children,
}: {
  id: string;
  n: string;
  title: string;
  intro?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-line py-14 md:py-20">
      <div className="grid grid-cols-12 gap-y-4">
        <p className="tabular col-span-12 font-mono text-xs text-muted md:col-span-3 md:pt-3">{`//${n}`}</p>
        <Reveal y={16} className="col-span-12 md:col-span-9">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <h2 id={`${id}-title`} className="max-w-[24ch] text-[clamp(1.75rem,3.2vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
                {title}
              </h2>
              {intro && <p className="mt-3 max-w-[60ch] leading-relaxed text-muted">{intro}</p>}
            </div>
            {aside}
          </div>
        </Reveal>
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}
