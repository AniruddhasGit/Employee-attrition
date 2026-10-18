"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { int, money } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export const REPLACEMENT_MIN = 10;
export const REPLACEMENT_MAX = 200;

/* A slim filled track with a round thumb; the input itself stays tall so it is easy to grab on a phone. */
const range = [
  "mt-3 h-8 w-full cursor-pointer appearance-none bg-transparent",
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full",
  "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--night-ink)_var(--fill),color-mix(in_srgb,var(--night-ink)_18%,transparent)_var(--fill))]",
  "[&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
  "[&::-webkit-slider-thumb]:bg-night-ink [&::-webkit-slider-thumb]:shadow-[0_0_0_6px_color-mix(in_srgb,var(--night-ink)_14%,transparent)]",
  "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:ease-out active:[&::-webkit-slider-thumb]:scale-110",
  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-night-ink/20",
  "[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-night-ink",
  "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-night-ink",
  "focus-visible:outline-night-ink",
].join(" ");

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
  const fill = ((replacement - REPLACEMENT_MIN) / (REPLACEMENT_MAX - REPLACEMENT_MIN)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : 12}px)` }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
      className="relative isolate flex h-full flex-col justify-between gap-10 overflow-hidden rounded-2xl bg-night p-6 ring-1 ring-inset ring-night-ink/10 text-night-ink shadow-[0_24px_60px_-30px_rgb(14_17_22/0.55)] md:p-8"
    >
      {/* Quiet warmth in the corner: the figure is about risk, so the glow borrows the signal hue. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 -z-10 size-80 rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--signal) 38%, transparent), transparent)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(to_right,var(--night-ink)_1px,transparent_1px),linear-gradient(to_bottom,var(--night-ink)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
      />

      <div>
        <p className="text-sm text-night-ink/70">Cost at stake</p>
        <p data-testid="cost-at-stake" data-value={Math.round(cost)} className="mt-4">
          <AnimatedNumber
            value={cost}
            format={money}
            className="text-[clamp(3.5rem,8vw,6.5rem)] font-semibold leading-none tracking-[-0.05em]"
          />
        </p>
        <p className="mt-5 max-w-[46ch] text-pretty text-sm leading-relaxed text-night-ink/70">
          What it would cost to replace the <span className="font-medium text-night-ink">{int(highRisk)} people</span> in the
          high-risk band, at {replacement}% of each person&apos;s annual salary.
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
          className={range}
          style={{ "--fill": `${fill}%` } as CSSProperties}
        />
        <p className="tabular flex justify-between text-xs text-night-ink/50" aria-hidden>
          <span>{REPLACEMENT_MIN}%</span>
          <span>{REPLACEMENT_MAX}%</span>
        </p>
        <p className="mt-4 text-pretty text-xs leading-relaxed text-night-ink/60">
          An assumption, not a fact. Estimates run from a fraction of salary for entry roles to more than a
          year for senior ones.
        </p>
      </div>
    </motion.div>
  );
}
