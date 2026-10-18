"use client";

import { motion, useReducedMotion } from "motion/react";
import type { DriverShare } from "@/lib/api";
import { pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";

/** Share of people for whom each factor is among those raising their score. One series, no track. */
export function TopDrivers({ drivers }: { drivers: DriverShare[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(...drivers.map((d) => d.share));
  return (
    <ul className="flex flex-col gap-4">
      {drivers.map((d, i) => (
        <li key={d.feature} className="grid grid-cols-12 items-center gap-3">
          <span className="col-span-5 text-sm md:col-span-4">{d.text}</span>
          <span className="relative col-span-5 h-3 md:col-span-6">
            <motion.span
              className="absolute inset-y-0 left-0 w-full origin-left rounded-r-[4px] bg-series-2"
              initial={{ transform: reduce ? `scaleX(${d.share / max})` : "scaleX(0)" }}
              whileInView={{ transform: `scaleX(${d.share / max})` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: EASE_OUT }}
            />
          </span>
          <span className="tabular col-span-2 text-right text-sm">{pct(d.share)}</span>
        </li>
      ))}
    </ul>
  );
}
