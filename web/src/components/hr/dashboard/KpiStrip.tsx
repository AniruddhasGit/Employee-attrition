"use client";

import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react";
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

/** A thin 0-100% meter that fills once on load. */
function Meter({
  value,
  tone,
  delay,
}: {
  value: number;
  tone: string;
  delay: number;
}) {
  const reduce = useReducedMotion();
  return (
    <span
      className="relative block h-1 overflow-hidden rounded-full bg-line"
      aria-hidden
    >
      <motion.span
        className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${tone}`}
        initial={{ transform: reduce ? `scaleX(${value})` : "scaleX(0)" }}
        animate={{ transform: `scaleX(${value})` }}
        transition={{ duration: 0.9, delay, ease: EASE_OUT }}
      />
    </span>
  );
}

function Tile({
  label,
  i,
  children,
  note,
}: {
  label: string;
  i: number;
  children: ReactNode;
  note: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : 12}px)` }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.5, delay: 0.16 + i * 0.06, ease: EASE_OUT }}
      className="flex min-w-0 flex-col justify-between gap-5 rounded-2xl border border-line bg-surface p-4 sm:p-5 md:gap-6 md:p-6"
    >
      <dt className="text-[13px] text-muted sm:text-sm">{label}</dt>
      <dd className="min-w-0">
        <div className="text-[clamp(1.75rem,3.4vw,2.75rem)] font-semibold leading-none tracking-[-0.035em]">
          {children}
        </div>
        <div className="mt-3 text-pretty text-xs leading-snug text-muted sm:text-sm">
          {note}
        </div>
      </dd>
    </motion.div>
  );
}

/** "Research & Development" -> "R&D", "Human Resources" -> "HR"; one-word names stay whole. */
function short(name: string): string {
  const words = name.split(" ");
  if (words.length < 2) return name;
  return words.map((w) => (w === "&" ? "&" : w[0].toUpperCase())).join("");
}

const SPLIT_TONES =["bg-ink", "bg-ink-soft/60", "bg-mist", "bg-haze"];

/** Headcount split by department: one segment per team, widths in proportion. */
function Split({ parts }: { parts: { name: string; n: number }[] }) {
  const reduce = useReducedMotion();
  return (
    <span className="flex h-1 gap-[3px]" aria-hidden>
      {parts.map((p, i) => (
        <motion.span
          key={p.name}
          title={p.name}
          className={`origin-left rounded-full ${SPLIT_TONES[i % SPLIT_TONES.length]}`}
          style={{ flexGrow: p.n, flexBasis: 0 }}
          initial={{ transform: reduce ? "scaleX(1)" : "scaleX(0)" }}
          animate={{ transform: "scaleX(1)" }}
          transition={{ duration: 0.6, delay: 0.3 + i * 0.08, ease: EASE_OUT }}
        />
      ))}
    </span>
  );
}

/** Headcount, high band, average score against last quarter, and check-in response. */
export function KpiStrip({ d }: { d: Dashboard }) {
  const delta = d.meanRiskPrev === null ? null : d.meanRisk - d.meanRiskPrev;
  const Arrow =
    delta === null || Math.abs(delta) < 0.0005
      ? ArrowRightIcon
      : delta > 0
        ? ArrowUpRightIcon
        : ArrowDownRightIcon;
  const deltaTone =
    delta !== null && delta >= 0.0005
      ? "text-signal"
      : delta !== null && delta <= -0.0005
        ? "text-calm"
        : "text-muted";
  const share = d.headcount ? d.highRisk / d.headcount : 0;
  const byDept = new Map<string, number>();
  for (const c of d.heatmap)
    byDept.set(c.department, (byDept.get(c.department) ?? 0) + c.n);
  const parts = [...byDept]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n);

  return (
    <dl className="grid h-full grid-cols-2 gap-3">
      <Tile
        label="People"
        i={0}
        note={
          <span className="flex flex-col gap-2.5">
            <Split parts={parts} />
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {parts.map((p, i) => (
                <span key={p.name} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                  <span className={`size-1.5 shrink-0 rounded-full ${SPLIT_TONES[i % SPLIT_TONES.length]}`} aria-hidden />
                  <abbr className="truncate no-underline" title={p.name}>{short(p.name)}</abbr>
                  <span className="tabular text-ink-soft">{int(p.n)}</span>
                </span>
              ))}
            </span>
          </span>
        }
      >
        <AnimatedNumber value={d.headcount} format={int} />
      </Tile>
      <Tile
        label="High risk"
        i={1}
        note={
          <span className="flex flex-col gap-2.5">
            <Meter value={share} tone="bg-signal" delay={0.35} />
            {pct(share, 1)} of staff in the high band
          </span>
        }
      >
        <span className="text-signal">
          <AnimatedNumber
            value={d.highRisk}
            format={int}
            testId="kpi-high-risk"
          />
        </span>
      </Tile>
      <Tile
        label="Average risk score"
        i={2}
        note={
          <span className="flex flex-col gap-2.5">
            <Meter value={d.meanRisk} tone="bg-ink-soft/70" delay={0.38} />
            {delta === null ? (
              `No ${d.previousQuarter} scores to compare`
            ) : (
              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span
                  className={`inline-flex items-center gap-1 font-medium ${deltaTone}`}
                >
                  <Arrow size={14} weight="bold" aria-hidden />
                  {pts(delta)}
                </span>
                <span>since {d.previousQuarter}</span>
              </span>
            )}
          </span>
        }
      >
        <AnimatedNumber value={d.meanRisk} format={(v) => pct(v, 1)} />
      </Tile>
      <Tile
        label="Check-in response"
        i={3}
        note={
          <span className="flex flex-col gap-2.5">
            <Meter value={d.responseRate} tone="bg-ink" delay={0.4} />
            Answered the {d.quarter} check-in
          </span>
        }
      >
        <AnimatedNumber value={d.responseRate} format={(v) => pct(v)} />
      </Tile>
    </dl>
  );
}
