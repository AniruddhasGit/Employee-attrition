"use client";

import { motion } from "motion/react";

/** A hairline scale 0-100% with the decision threshold marked and a springing marker. */
export function RiskMeter({ value, threshold, label = "Risk score" }: { value: number; threshold: number; label?: string }) {
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="relative h-2">
        <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <div
          className="absolute top-0 h-2 w-px bg-ink/50"
          style={{ left: `${threshold * 100}%` }}
          title={`Threshold ${Math.round(threshold * 100)}%`}
        />
        <motion.div
          className="absolute inset-x-0 top-0 h-2"
          initial={false}
          animate={{ transform: `translateX(${value * 100}%)` }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
        >
          <span className={`absolute -left-1.5 top-1/2 size-3 -translate-y-1/2 rounded-full ${value >= threshold ? "bg-signal" : "bg-calm"}`} />
        </motion.div>
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-muted">
        <span className="absolute left-0">0%</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${threshold * 100}%` }}>
          flag line {Math.round(threshold * 100)}%
        </span>
        <span className="absolute right-0">100%</span>
      </div>
    </div>
  );
}
