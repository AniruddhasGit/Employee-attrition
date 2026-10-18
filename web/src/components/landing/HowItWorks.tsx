import { Reveal } from "@/components/ui/Reveal";

const STEPS = [
  {
    n: "01",
    id: "check-in",
    title: "Check in",
    who: "Employees",
    body: "Once a quarter, eight short questions on how work feels, plus what would keep them here. They see their answers, never a score.",
  },
  {
    n: "02",
    id: "predict",
    title: "Predict",
    who: "HR",
    body: "Fresh answers re-score everyone. HR sees who is at risk, why, in plain words, and who dropped sharply since last time.",
  },
  {
    n: "03",
    id: "act",
    title: "Act",
    who: "HR",
    body: "Pick an action for a person: a pay review, a promotion talk, less overtime. The model estimates the effect before you commit.",
  },
  {
    n: "04",
    id: "retain",
    title: "Retain",
    who: "Both",
    body: "Next quarter's check-in shows whether risk really fell. Teams see what changed because of what they said.",
  },
];

/** The product loop, one step per row, numbered like the hero index. */
export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="mx-auto max-w-[1400px] scroll-mt-8 px-4 py-24 md:px-8 md:py-32">
      <div className="grid grid-cols-12 gap-y-6">
        <p className="col-span-12 text-sm text-muted md:col-span-3">How it works</p>
        <Reveal className="col-span-12 md:col-span-9">
          <h2 id="how-title" className="max-w-[20ch] text-[clamp(2rem,4.6vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
            A loop, not a report.
          </h2>
        </Reveal>
      </div>
      <ol className="mt-16 border-t border-line">
        {STEPS.map((s, i) => (
          <Reveal as="li" key={s.n} delay={0.05 * i} y={16} className="border-b border-line">
            <div id={s.id} className="grid scroll-mt-24 grid-cols-12 gap-y-3 py-8 md:py-10">
              <span className="tabular col-span-2 font-mono text-xs text-muted md:col-span-1">{`//${s.n}`}</span>
              <h3 className="col-span-10 text-[clamp(1.75rem,3.2vw,2.75rem)] font-semibold leading-none tracking-[-0.03em] md:col-span-4">
                {s.title}
              </h3>
              <p className="col-span-12 max-w-[52ch] leading-relaxed text-muted md:col-span-5 md:col-start-7">{s.body}</p>
              <span className="col-span-12 self-start justify-self-start rounded-full border border-line px-3 py-1 text-xs text-ink-soft md:col-span-1 md:col-start-12 md:justify-self-end">
                {s.who}
              </span>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
