"use client";

import { ArrowRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import type { SharpDrop } from "@/lib/api";
import { pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";

const FIRST = 6;

/** Answer drops first (they say what changed), then the biggest score jumps. */
function order(drops: SharpDrop[]): SharpDrop[] {
  const jump = (d: SharpDrop) => d.riskScore - d.prevRiskScore;
  return [...drops].sort((a, b) => Number(b.fields.length > 0) - Number(a.fields.length > 0) || jump(b) - jump(a));
}

/** Last quarter's score (hollow) to this quarter's (filled) on a 0-100% hairline. */
function Dumbbell({ from, to }: { from: number; to: number }) {
  const lo = Math.min(from, to) * 100;
  const hi = Math.max(from, to) * 100;
  return (
    <span className="relative block h-3 w-full" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
      <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-signal/60" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
      <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted bg-surface" style={{ left: `${from * 100}%` }} />
      <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal" style={{ left: `${to * 100}%` }} />
    </span>
  );
}

function Card({ d, i }: { d: SharpDrop; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={!reduce}
      initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : 10}px)` }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.4, delay: Math.min(i % FIRST, 8) * 0.05, ease: EASE_OUT }}
    >
      <Link
        href={`/hr/people/${d.id}`}
        className="group flex h-full flex-col gap-5 rounded-2xl border border-line bg-surface p-5 transition-[border-color,transform] duration-200 ease-out hover:border-ink/30 active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{d.name}</p>
            <p className="mt-0.5 truncate text-sm text-muted">
              {d.jobRole} · {d.department}
            </p>
          </div>
          <ArrowRightIcon size={16} className="mt-1 shrink-0 text-muted transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>

        <div>
          <p className="tabular flex items-baseline justify-between text-sm">
            <span className="text-muted">Risk score</span>
            <span>
              <span className="text-muted">{pct(d.prevRiskScore)}</span>
              <span className="mx-1.5 text-muted">→</span>
              <span className="font-semibold text-signal">{pct(d.riskScore)}</span>
            </span>
          </p>
          <div className="mt-2">
            <Dumbbell from={d.prevRiskScore} to={d.riskScore} />
          </div>
        </div>

        <ul className="mt-auto flex flex-wrap gap-1.5">
          {d.fields.map((f) => (
            <li key={f.column} className="tabular inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft">
              <span className="first-letter:uppercase">{f.label}</span>
              <span className="text-muted">
                {f.from} → {f.to}
              </span>
            </li>
          ))}
          {d.fields.length === 0 && (
            <li className="inline-flex rounded-full border border-line px-2.5 py-1 text-xs text-muted">Score jumped on several smaller changes</li>
          )}
        </ul>
      </Link>
    </motion.li>
  );
}

/** Early warning: people whose answers or score fell sharply since their last check-in. */
export function SharpDrops({ drops, previousQuarter }: { drops: SharpDrop[]; previousQuarter: string }) {
  const [all, setAll] = useState(false);
  const sorted = order(drops);
  const shown = all ? sorted : sorted.slice(0, FIRST);

  if (drops.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-6 text-muted">
        Nobody&apos;s answers fell sharply since {previousQuarter}.
      </p>
    );
  }

  return (
    <div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {shown.map((d, i) => (
            <Card key={d.id} d={d} i={i} />
          ))}
        </AnimatePresence>
      </ul>
      {drops.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm transition-[background-color,transform] duration-150 ease-out hover:bg-surface active:scale-[0.97]"
        >
          {all ? "Show fewer" : `Show all ${drops.length}`}
          <CaretDownIcon size={14} className={`transition-transform duration-200 ease-out ${all ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
