"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Driver } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";

/** Diverging bars from a centre line: left lowers risk, right raises it. Lengths are relative. */
export function DriverBars({ drivers }: { drivers: Driver[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(...drivers.map((d) => Math.abs(d.impact)), 0.0001);

  return (
    <div>
      <div className="mb-3 flex justify-between text-xs text-muted">
        <span>Lowers risk</span>
        <span>Raises risk</span>
      </div>
      <ul className="flex flex-col gap-3">
        {drivers.map((d) => {
          const frac = Math.abs(d.impact) / max;
          const raises = d.direction === "raises";
          return (
            <motion.li key={d.feature} layout={!reduce} transition={{ duration: 0.3, ease: EASE_OUT }} className="grid grid-cols-2 items-center gap-x-0">
              <span className="col-span-2 mb-1 text-sm">{d.text}</span>
              <span className="relative h-2 border-r border-ink/30">
                {!raises && (
                  <motion.span
                    className="absolute inset-y-0 right-0 w-full origin-right rounded-l-full bg-calm"
                    initial={false}
                    animate={{ transform: `scaleX(${frac})` }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                  />
                )}
              </span>
              <span className="relative h-2">
                {raises && (
                  <motion.span
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-r-full bg-signal"
                    initial={false}
                    animate={{ transform: `scaleX(${frac})` }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                  />
                )}
              </span>
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Bar length shows each factor&apos;s pull relative to the others for this person, not a
        percentage.
      </p>
    </div>
  );
}
