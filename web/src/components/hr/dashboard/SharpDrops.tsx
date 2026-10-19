"use client";

import { ArrowRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import type { SharpDrop } from "@/lib/api";
import { pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { Lift } from "@/components/ui/motion";

const FIRST = 6;

/** Answer drops first (they say what changed), then the biggest score jumps. */
function order(drops: SharpDrop[]): SharpDrop[] {
  const jump = (d: SharpDrop) => d.riskScore - d.prevRiskScore;
  return [...drops].sort((a, b) => Number(b.fields.length > 0) - Number(a.fields.length > 0) || jump(b) - jump(a));
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

/**
 * Last quarter's score (hollow) to this quarter's (filled) on a 0-100% hairline.
 * On first view the filled dot travels from the old score to the new one, so the change reads as movement.
 */
function Dumbbell({ from, to }: { from: number; to: number }) {
  const reduce = useReducedMotion();
  const lo = Math.min(from, to) * 100;
  const hi = Math.max(from, to) * 100;
  const view = { once: true, amount: 0.6 } as const;
  const t = { duration: 0.8, delay: 0.15, ease: EASE_OUT };
  return (
    <span className="relative block h-3 w-full" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
      <motion.span
        className="absolute top-1/2 h-0.5 bg-signal/60"
        style={{ left: `${lo}%`, width: `${hi - lo}%`, transformOrigin: to >= from ? "left" : "right" }}
        initial={{ transform: reduce ? "translateY(-50%) scaleX(1)" : "translateY(-50%) scaleX(0)" }}
        whileInView={{ transform: "translateY(-50%) scaleX(1)" }}
        viewport={view}
        transition={t}
      />
      <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted bg-surface" style={{ left: `${from * 100}%` }} />
      {/* Full-width rail moved by its own width, so translateX(%) maps straight onto the score. */}
      <motion.span
        className="absolute inset-0"
        initial={{ transform: `translateX(${(reduce ? to : from) * 100}%)` }}
        whileInView={{ transform: `translateX(${to * 100}%)` }}
        viewport={view}
        transition={t}
      >
        <span className="absolute left-0 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal shadow-[0_0_0_3px_var(--surface)]" />
      </motion.span>
    </span>
  );
}

function Card({ d, i }: { d: SharpDrop; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={!reduce}
      className="w-[84%] shrink-0 snap-start sm:w-auto"
      // Rises in as the section scrolls into view (cards added by "Show all" rise as they arrive).
      initial={{ opacity: 0, y: reduce ? 0 : 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.5, delay: (i % FIRST) * 0.06, ease: EASE_OUT, layout: { duration: 0.3, ease: EASE_OUT } }}
    >
      <Lift className="h-full rounded-2xl">
      <Link
        href={`/hr/people/${d.id}`}
        className="group flex h-full flex-col gap-5 overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-[border-color] duration-200 ease-out hover:border-ink/25"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-full bg-signal-soft text-xs font-semibold tracking-wide text-signal"
              aria-hidden
            >
              {initials(d.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{d.name}</p>
              <p className="mt-0.5 truncate text-sm text-muted">
                {d.jobRole} · {d.department}
              </p>
            </div>
          </div>
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted transition-[background-color,color,border-color] duration-200 ease-out group-hover:border-ink group-hover:bg-ink group-hover:text-bg">
            <ArrowRightIcon size={14} className="transition-transform duration-200 ease-out group-hover:translate-x-px" aria-hidden />
          </span>
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
          <div className="mt-2.5">
            <Dumbbell from={d.prevRiskScore} to={d.riskScore} />
          </div>
        </div>

        <ul className="mt-auto flex flex-wrap gap-1.5">
          {d.fields.map((f) => (
            <li key={f.column} className="tabular inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-xs text-ink-soft ring-1 ring-line">
              <span className="first-letter:uppercase">{f.label}</span>
              <span className="text-muted">
                {f.from} → {f.to}
              </span>
            </li>
          ))}
          {d.fields.length === 0 && (
            <li className="inline-flex rounded-full bg-bg px-2.5 py-1 text-xs text-muted ring-1 ring-line">Score jumped on several smaller changes</li>
          )}
        </ul>
      </Link>
      </Lift>
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
      <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-muted">
        Nobody&apos;s answers fell sharply since {previousQuarter}. Steady quarter.
      </p>
    );
  }

  return (
    <div>
      {/* Phone: one swipeable row. Larger screens: a grid. */}
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        <AnimatePresence>
          {shown.map((d, i) => (
            <Card key={d.id} d={d} i={i} />
          ))}
        </AnimatePresence>
      </ul>
      {drops.length > FIRST && (
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            aria-expanded={all}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-medium transition-[background-color,border-color,transform] duration-150 ease-out hover:border-ink/25 hover:bg-surface active:scale-[0.97]"
          >
            {all ? "Show fewer" : `Show all ${drops.length}`}
            <CaretDownIcon size={14} className={`transition-transform duration-200 ease-out ${all ? "rotate-180" : ""}`} aria-hidden />
          </button>
          <p className="text-sm text-muted sm:hidden">Swipe for more</p>
        </div>
      )}
    </div>
  );
}
