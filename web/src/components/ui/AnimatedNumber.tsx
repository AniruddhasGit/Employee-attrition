"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";
import { EASE_OUT } from "@/lib/motion";

/** Tweens to each new value (no React re-render per frame). Reduced motion: jumps. */
export function AnimatedNumber({
  value,
  format,
  duration = 0.6,
  className,
  testId,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
  className?: string;
  testId?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, format);

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: EASE_OUT });
    return () => controls.stop();
  }, [value, duration, reduce, mv]);

  return (
    <motion.span data-testid={testId} className={`tabular ${className ?? ""}`}>
      {text}
    </motion.span>
  );
}
