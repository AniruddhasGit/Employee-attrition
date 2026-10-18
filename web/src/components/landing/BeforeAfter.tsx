"use client";

import { motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { CompareSlider, useCompareDriver } from "./before-after/CompareSlider";
import { getPublicSummary, type MetricSet, type Metrics } from "@/lib/api";
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

const loadMetrics = () => getPublicSummary().then((s) => s.metrics);

function flagged(m: MetricSet) {
  const [[tn, fp], [fn, tp]] = m.confusion;
  return { flagged: fp + tp, total: tn + fp + fn + tp, caught: tp, leavers: fn + tp };
}

function MetricValue({ before, after, t }: { before: number; after: number; t: MotionValue<number> }) {
  const text = useTransform(t, (v) => (before + (after - before) * v).toFixed(3));
  return <motion.span className="tabular">{text}</motion.span>;
}

/** Each fault comes into focus as the story moves toward the honest model; all stay readable. */
function BugItem({ bug, i, t }: { bug: (typeof BUGS)[number]; i: number; t: MotionValue<number> }) {
  const start = 0.15 + i * 0.15;
  const opacity = useTransform(t, [start, start + 0.25], [0.4, 1]);
  const transform = useTransform(t, [start, start + 0.25], ["translateY(6px)", "translateY(0px)"]);
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

function Story({ m, reduce }: { m: Metrics; reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useMotionValue(reduce ? 1 : 0);
  const driver = useCompareDriver(t, ref, reduce);
  const beforeOpacity = useTransform(t, [0, 0.5], [1, 0]);
  const afterOpacity = useTransform(t, [0.5, 1], [0, 1]);
  const b = flagged(m.before);
  const a = flagged(m.after);

  return (
    <div ref={ref}>
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-12 gap-x-6 gap-y-10 px-4 py-24 md:px-8 md:py-32">
        <div className="col-span-12 md:col-span-5">
          <h2
            id="before-after-title"
            className="text-[clamp(2rem,4.4vw,4rem)] font-semibold leading-[1] tracking-[-0.035em]"
          >
            It looked perfect.
            <br />
            It wasn&apos;t.
          </h2>
          <CompareSlider t={t} driver={driver} />
          <div className="relative mt-6 h-14 text-sm md:text-base">
            <motion.p style={{ opacity: beforeOpacity }} className="absolute inset-0 text-muted">
              <span className="font-medium text-ink">Before:</span> the original predictor, scored on the people it
              trained on. Flagged {int(b.flagged)} of {int(b.total)} as leavers.
            </motion.p>
            <motion.p style={{ opacity: afterOpacity }} className="absolute inset-0 text-muted">
              <span className="font-medium text-ink">After:</span> tested on {m.nTest} people it never saw. Flagged{" "}
              {a.flagged}, caught {a.caught} of {a.leavers} who left.
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
            <BugItem key={bug.title} bug={bug} i={i} t={t} />
          ))}
        </ol>
      </div>
    </div>
  );
}

export function BeforeAfter() {
  const reduce = useReducedMotion();
  const { data, error, loading, retry } = useApi(loadMetrics);

  return (
    <section data-testid="before-after" aria-labelledby="before-after-title" className="bg-surface">
      {loading && (
        <div className="mx-auto max-w-[1400px] px-4 py-24 md:px-8">
          <Skeleton className="h-[60dvh]" />
        </div>
      )}
      {error && (
        <div className="mx-auto max-w-[1400px] px-4 py-24 md:px-8">
          <h2 id="before-after-title" className="mb-6 text-3xl font-semibold">
            It looked perfect. It wasn&apos;t.
          </h2>
          <ErrorState message={error.message} status={error.status} onRetry={retry} />
        </div>
      )}
      {data && <Story m={data} reduce={!!reduce} />}
    </section>
  );
}
