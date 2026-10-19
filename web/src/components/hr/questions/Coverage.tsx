"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";

/** Share of staff who have answered, against the line a question must reach before it can join the scores. */
export function Coverage({
  value,
  needed,
  label,
  size = "sm",
}: {
  value: number;
  needed: number;
  label: string;
  size?: "sm" | "lg";
}) {
  const reduce = useReducedMotion();
  // Fills when it scrolls into view, then follows new answers as they come in.
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.8 });
  const reached = value >= needed;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="tabular text-muted">{label}</span>
        <span className={`tabular font-medium ${reached ? "text-calm" : "text-ink"}`}>{pct(v)}</span>
      </div>
      <div
        ref={ref}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        className={`relative mt-2 rounded-full bg-haze/60 ${size === "lg" ? "mb-6 h-2" : "mb-5 h-1.5"}`}
      >
        <motion.div
          className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${reached ? "bg-calm" : "bg-ink"}`}
          initial={{ scaleX: reduce ? v : 0 }}
          animate={{ scaleX: seen || reduce ? v : 0 }}
          transition={{ duration: reduce ? 0 : 0.8, ease: EASE_OUT }}
        />
        <span aria-hidden className="absolute -top-1 h-[calc(100%+0.5rem)] w-px bg-ink/70" style={{ left: `${needed * 100}%` }}>
          <span className="absolute left-1/2 top-[calc(100%+3px)] -translate-x-1/2 whitespace-nowrap text-[10px] text-muted">
            {pct(needed)} needed
          </span>
        </span>
      </div>
    </div>
  );
}
