"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Driver } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";

/** Diverging bars from a centre line: left lowers risk, right raises it. Lengths are relative. */
export function DriverBars({ drivers }: { drivers: Driver[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(...drivers.map((d) => Math.abs(d.impact)), 0.0001);
  // Bars grow in with a stagger the first time; after that they retarget straight away (the what-if moves them).
  const list = useRef<HTMLUListElement>(null);
  const seen = useInView(list, { once: true, amount: 0.3 });
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!seen) return;
    const t = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(t);
  }, [seen]);
  const shown = seen || !!reduce;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 text-xs text-muted">
        <span className="flex items-center gap-1.5 pr-3">
          <ArrowLeftIcon size={11} aria-hidden /> Lowers risk
        </span>
        <span className="flex items-center justify-end gap-1.5 pl-3">
          Raises risk <ArrowRightIcon size={11} aria-hidden />
        </span>
      </div>
      <ul ref={list} className="relative flex flex-col gap-4">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line" />
        {drivers.map((d, i) => {
          const frac = Math.abs(d.impact) / max;
          const raises = d.direction === "raises";
          const delay = reduce || settled ? 0 : 0.1 + i * 0.05;
          const scale = `scaleX(${shown ? frac : 0})`;
          return (
            <motion.li
              key={d.feature}
              layout={!reduce}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="grid grid-cols-2 items-center"
            >
              <span className="col-span-2 mb-1.5 flex items-center gap-2 text-sm">
                <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${raises ? "bg-signal" : "bg-calm"}`} />
                <span className="min-w-0">{d.text}</span>
                <span className="sr-only">{raises ? "(raises risk)" : "(lowers risk)"}</span>
              </span>
              <span className="relative h-2.5 rounded-l-full bg-haze/25">
                {!raises && (
                  <motion.span
                    className="absolute inset-y-0 right-0 w-full origin-right rounded-l-full bg-calm"
                    initial={reduce ? false : { transform: "scaleX(0)" }}
                    animate={{ transform: scale }}
                    transition={{ duration: 0.6, delay, ease: EASE_OUT }}
                  />
                )}
              </span>
              <span className="relative h-2.5 rounded-r-full bg-haze/25">
                {raises && (
                  <motion.span
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-r-full bg-signal"
                    initial={reduce ? false : { transform: "scaleX(0)" }}
                    animate={{ transform: scale }}
                    transition={{ duration: 0.6, delay, ease: EASE_OUT }}
                  />
                )}
              </span>
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-5 text-xs leading-relaxed text-muted">
        Bar length shows each factor&apos;s pull relative to the others for this person, not a percentage.
      </p>
    </div>
  );
}
