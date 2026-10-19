"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { EASE_OUT } from "@/lib/motion";

/**
 * Counts from `from` to `value` the first time it scrolls into view, then tweens to later values.
 * Renders the final text for reduced motion. No React re-render per frame.
 */
export function CountUp({
  value,
  format,
  from = 0,
  duration = 1.2,
  className,
  testId,
}: {
  value: number;
  format: (v: number) => string;
  from?: number;
  duration?: number;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : from);
  const text = useTransform(mv, format);

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(mv, value, { duration, ease: EASE_OUT });
    return () => controls.stop();
  }, [inView, value, duration, reduce, mv]);

  return (
    <motion.span ref={ref} data-testid={testId} className={`tabular ${className ?? ""}`}>
      {text}
    </motion.span>
  );
}
