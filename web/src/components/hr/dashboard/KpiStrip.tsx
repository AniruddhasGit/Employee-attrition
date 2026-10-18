"use client";

import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import type { Dashboard } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

/** Percentage-point change with one decimal, e.g. 0.0045 -> "+0.5 pts". */
function pts(delta: number): string {
  const v = Math.round(delta * 1000) / 10;
  if (v === 0) return "no change";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)} pts`;
}

function Tile({ label, i, children, note }: { label: string; i: number; children: ReactNode; note: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : 12}px)` }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.5, delay: 0.08 + i * 0.06, ease: EASE_OUT }}
      className="flex flex-col justify-between gap-6 rounded-2xl border border-line bg-surface p-5 md:p-6"
    >
      <dt className="text-sm text-muted">{label}</dt>
      <dd>
        <div className="text-[clamp(2rem,3.4vw,2.75rem)] font-semibold leading-none tracking-[-0.035em]">{children}</div>
        <div className="mt-3 text-sm text-muted">{note}</div>
      </dd>
    </motion.div>
  );
}

/** Headcount, high band, average score against last quarter, and check-in response. */
export function KpiStrip({ d }: { d: Dashboard }) {
  const reduce = useReducedMotion();
  const delta = d.meanRiskPrev === null ? null : d.meanRisk - d.meanRiskPrev;
  const Arrow = delta === null || Math.abs(delta) < 0.0005 ? ArrowRightIcon : delta > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  const deltaTone = delta !== null && delta >= 0.0005 ? "text-signal" : delta !== null && delta <= -0.0005 ? "text-calm" : "text-muted";

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Tile label="People" i={0} note="Current employees">
        <AnimatedNumber value={d.headcount} format={int} />
      </Tile>
      <Tile label="High risk" i={1} note={`${pct(d.highRisk / d.headcount, 1)} of staff in the high band`}>
        <span className="text-signal">
          <AnimatedNumber value={d.highRisk} format={int} testId="kpi-high-risk" />
        </span>
      </Tile>
      <Tile
        label="Average risk score"
        i={2}
        note={
          delta === null ? (
            `No ${d.previousQuarter} scores to compare`
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 font-medium ${deltaTone}`}>
                <Arrow size={14} weight="bold" aria-hidden />
                {pts(delta)}
              </span>
              <span>since {d.previousQuarter}</span>
            </span>
          )
        }
      >
        <AnimatedNumber value={d.meanRisk} format={(v) => pct(v, 1)} />
      </Tile>
      <Tile
        label="Check-in response"
        i={3}
        note={
          <span className="flex flex-col gap-2">
            <span className="relative block h-1 overflow-hidden rounded-full bg-line" aria-hidden>
              <motion.span
                className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-ink"
                initial={{ transform: reduce ? `scaleX(${d.responseRate})` : "scaleX(0)" }}
                animate={{ transform: `scaleX(${d.responseRate})` }}
                transition={{ duration: 0.8, delay: 0.3, ease: EASE_OUT }}
              />
            </span>
            Answered the {d.quarter} check-in
          </span>
        }
      >
        <AnimatedNumber value={d.responseRate} format={(v) => pct(v)} />
      </Tile>
    </dl>
  );
}
