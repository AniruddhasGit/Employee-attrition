"use client";

import { motion, useReducedMotion } from "motion/react";
import type { MetricSet, Metrics } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";

const TILES: { key: keyof MetricSet; label: string; plain: string; lowerBetter?: boolean }[] = [
  { key: "roc_auc", label: "ROC-AUC", plain: "Ranks a leaver above a stayer this often." },
  { key: "pr_auc", label: "PR-AUC", plain: "Ranking quality focused on the people who left." },
  { key: "precision", label: "Precision", plain: "Of those flagged, the share who actually left." },
  { key: "recall", label: "Recall", plain: "Of those who left, the share that was flagged." },
  { key: "brier", label: "Brier score", plain: "Average probability error. Lower is better.", lowerBetter: true },
];

function Whisker({ value, lo, hi, before }: { value: number; lo: number; hi: number; before: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mt-4 h-5" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
      <motion.div
        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink/70"
        style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%`, transformOrigin: "center" }}
        initial={{ transform: reduce ? "scaleX(1)" : "scaleX(0)" }}
        whileInView={{ transform: "scaleX(1)" }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      />
      <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${value * 100}%` }} />
      <span
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-signal bg-bg"
        style={{ left: `${before * 100}%` }}
        title="Original notebook"
      />
    </div>
  );
}

export function MetricsCI({ m }: { m: Metrics }) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-5 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink" />Honest model, with its 95% range</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-signal" />What the original notebook would have claimed</span>
      </div>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => {
          const value = m.after[t.key] as number;
          const [lo, hi] = m.after.ci?.[t.key] ?? [value, value];
          const before = m.before[t.key] as number;
          return (
            <li key={t.key} data-testid={`metric-${t.key}`} className="border-t border-line pt-4">
              <p className="text-sm font-medium">{t.label}</p>
              <p className="tabular mt-2 text-5xl font-semibold leading-none tracking-[-0.04em]">{value.toFixed(3)}</p>
              <p className="tabular mt-2 text-sm text-muted">
                95% range {lo.toFixed(2)} to {hi.toFixed(2)}
              </p>
              <Whisker value={value} lo={lo} hi={hi} before={before} />
              <div className="mt-1 flex justify-between text-[11px] text-muted"><span>0</span><span>1</span></div>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {t.plain} The original claimed {before.toFixed(3)}.
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
