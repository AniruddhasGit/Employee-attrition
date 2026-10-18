"use client";

import { motion, useReducedMotion } from "motion/react";
import { int, money } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export const REPLACEMENT_MIN = 10;
export const REPLACEMENT_MAX = 200;

/**
 * Cost at stake = sum of annual salary x replacement % over the high-risk band.
 * Linear in the replacement %, so the parent rescales the API's figure instead of refetching.
 */
export function CostAtStake({
  cost,
  highRisk,
  replacement,
  onReplacement,
}: {
  cost: number;
  highRisk: number;
  replacement: number;
  onReplacement: (pct: number) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : 12}px)` }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="flex h-full flex-col justify-between gap-10 rounded-2xl bg-night p-6 text-night-ink md:p-8"
    >
      <div>
        <p className="text-sm text-night-ink/70">Cost at stake</p>
        <p data-testid="cost-at-stake" data-value={Math.round(cost)} className="mt-3">
          <AnimatedNumber
            value={cost}
            format={money}
            className="text-[clamp(3.25rem,7vw,6rem)] font-semibold leading-none tracking-[-0.045em]"
          />
        </p>
        <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-night-ink/70">
          What it would cost to replace the {int(highRisk)} people in the high-risk band, at {replacement}% of
          each person&apos;s annual salary.
        </p>
      </div>

      <div>
        <label htmlFor="replacement" className="flex items-baseline justify-between gap-4 text-sm">
          <span className="font-medium">Replacement cost</span>
          <span className="tabular text-night-ink/70">{replacement}% of salary</span>
        </label>
        <input
          id="replacement"
          type="range"
          min={REPLACEMENT_MIN}
          max={REPLACEMENT_MAX}
          step={5}
          value={replacement}
          aria-valuetext={`${replacement}% of salary`}
          onChange={(e) => onReplacement(Number(e.target.value))}
          className="mt-4 w-full cursor-pointer accent-[var(--night-ink)]"
        />
        <p className="mt-3 text-xs leading-relaxed text-night-ink/60">
          An assumption, not a fact. Estimates run from a fraction of salary for entry roles to more than a
          year for senior ones.
        </p>
      </div>
    </motion.div>
  );
}
