"use client";

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { getMetrics, type MetricSet, type Metrics } from "@/lib/api";
import { int } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";

const ROWS: { key: keyof MetricSet; label: string; note: string }[] = [
  { key: "roc_auc", label: "ROC-AUC", note: "How well it ranks leavers above stayers" },
  { key: "precision", label: "Precision", note: "Of those flagged, how many actually left" },
  { key: "recall", label: "Recall", note: "Of those who left, how many were flagged" },
  { key: "brier", label: "Brier score", note: "Probability error. Lower is better" },
];

const BUGS = [
  { title: "Graded on its own homework", body: "It was trained and scored on the same 1,470 rows, so the ranking looked near perfect." },
  { title: "No hold-out at all", body: "The evaluation cell was commented out, and it fitted a model that was never used." },
  { title: "Categories zeroed", body: "Scoring one row at a time dropped every category: overtime, job role, department, travel." },
  { title: "A 0.9 cut-off called confidence", body: "An 89% chance of leaving was printed as \"Likely to Stay\"." },
];

function flagged(m: MetricSet) {
  const [[tn, fp], [fn, tp]] = m.confusion;
  return { flagged: fp + tp, total: tn + fp + fn + tp, caught: tp, leavers: fn + tp };
}

function MetricValue({ before, after, t }: { before: number; after: number; t: MotionValue<number> }) {
  const text = useTransform(t, (v) => (before + (after - before) * v).toFixed(3));
  return <motion.span className="tabular">{text}</motion.span>;
}

function BugItem({ bug, i, progress }: { bug: (typeof BUGS)[number]; i: number; progress: MotionValue<number> }) {
  const start = 0.18 + i * 0.13;
  const opacity = useTransform(progress, [start, start + 0.08], [0, 1]);
  const transform = useTransform(progress, [start, start + 0.08], ["translateY(16px)", "translateY(0px)"]);
  return (
    <motion.li style={{ opacity, transform }} className="border-t border-line pt-3">
      <p className="text-sm font-medium">
        <span className="tabular mr-2 font-mono text-xs text-signal">{i + 1}</span>
        {bug.title}
      </p>
      <p className="mt-1 hidden text-sm leading-relaxed text-muted md:block">{bug.body}</p>
    </motion.li>
  );
}

/** Where the story is: a dot travelling from the original notebook to the honest model. */
function StateRail({ t }: { t: MotionValue<number> }) {
  const transform = useTransform(t, (v) => `translateX(${v * 100}%)`);
  const beforeOpacity = useTransform(t, [0, 0.5], [1, 0.7]);
  const afterOpacity = useTransform(t, [0.5, 1], [0.7, 1]);
  return (
    <div className="mt-8 max-w-sm" aria-hidden>
      <div className="relative h-px bg-line">
        <motion.div style={{ transform }} className="absolute inset-x-0 -top-[5px]">
          <span className="absolute -left-[5px] size-[11px] rounded-full bg-signal" />
        </motion.div>
      </div>
      <div className="mt-3 flex justify-between text-xs">
        <motion.span style={{ opacity: beforeOpacity }}>Original notebook</motion.span>
        <motion.span style={{ opacity: afterOpacity }}>Honest model</motion.span>
      </div>
    </div>
  );
}

function Story({ m }: { m: Metrics }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const t = useTransform(scrollYProgress, [0.12, 0.6], [0, 1], { clamp: true });
  const beforeOpacity = useTransform(t, [0, 0.5], [1, 0]);
  const afterOpacity = useTransform(t, [0.5, 1], [0, 1]);
  const b = flagged(m.before);
  const a = flagged(m.after);

  return (
    <div ref={ref} className="relative h-[340vh]">
      <div className="sticky top-0 flex min-h-[100dvh] items-center">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-12 gap-x-6 gap-y-8 px-4 py-16 md:px-8">
          <div className="col-span-12 md:col-span-5">
            <h2 id="before-after-title" className="text-[clamp(2rem,4.4vw,4rem)] font-semibold leading-[1] tracking-[-0.035em]">
              It looked perfect.
              <br />
              It wasn&apos;t.
            </h2>
            <StateRail t={t} />
            <div className="relative mt-6 h-14 text-sm md:text-base">
              <motion.p style={{ opacity: beforeOpacity }} className="absolute inset-0 text-muted">
                <span className="font-medium text-ink">Before:</span> the original predictor, scored on
                the people it trained on. Flagged {int(b.flagged)} of {int(b.total)} as leavers.
              </motion.p>
              <motion.p style={{ opacity: afterOpacity }} className="absolute inset-0 text-muted">
                <span className="font-medium text-ink">After:</span> tested on {m.nTest} people it never
                saw. Flagged {a.flagged}, caught {a.caught} of {a.leavers} who left.
              </motion.p>
            </div>
          </div>

          <dl className="col-span-12 grid grid-cols-2 gap-x-6 gap-y-6 md:col-span-6 md:col-start-7">
            {ROWS.map((row) => (
              <div key={row.key} className="border-t border-line pt-3">
                <dt className="text-sm font-medium">{row.label}</dt>
                <dd className="mt-1 text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-none tracking-[-0.04em]">
                  <MetricValue before={m.before[row.key] as number} after={m.after[row.key] as number} t={t} />
                </dd>
                <dd className="mt-2 hidden text-xs text-muted md:block">{row.note}</dd>
              </div>
            ))}
          </dl>

          <ol className="col-span-12 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            {BUGS.map((bug, i) => (
              <BugItem key={bug.title} bug={bug} i={i} progress={scrollYProgress} />
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function StaticStory({ m }: { m: Metrics }) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-24 md:px-8">
      <h2 id="before-after-title" className="text-4xl font-semibold tracking-[-0.035em]">
        It looked perfect. It wasn&apos;t.
      </h2>
      <dl className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
        {ROWS.map((row) => (
          <div key={row.key} className="border-t border-line pt-3">
            <dt className="text-sm font-medium">{row.label}</dt>
            <dd className="tabular mt-1 text-muted line-through">{(m.before[row.key] as number).toFixed(3)}</dd>
            <dd className="tabular text-4xl font-semibold">{(m.after[row.key] as number).toFixed(3)}</dd>
          </div>
        ))}
      </dl>
      <ol className="mt-10 grid gap-4 md:grid-cols-4">
        {BUGS.map((bug, i) => (
          <li key={bug.title} className="border-t border-line pt-3 text-sm">
            <p className="font-medium">{i + 1}. {bug.title}</p>
            <p className="mt-1 text-muted">{bug.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function BeforeAfter() {
  const reduce = useReducedMotion();
  const { data, error, loading, retry } = useApi(getMetrics);

  return (
    <section data-testid="before-after" aria-labelledby="before-after-title" className="bg-surface">
      {loading && (
        <div className="mx-auto max-w-[1400px] px-4 py-24 md:px-8">
          <Skeleton className="h-[60dvh]" />
        </div>
      )}
      {error && (
        <div className="mx-auto max-w-[1400px] px-4 py-24 md:px-8">
          <h2 id="before-after-title" className="mb-6 text-3xl font-semibold">It looked perfect. It wasn&apos;t.</h2>
          <ErrorState message={error.message} onRetry={retry} />
        </div>
      )}
      {data && (reduce ? <StaticStory m={data} /> : <Story m={data} />)}
    </section>
  );
}
