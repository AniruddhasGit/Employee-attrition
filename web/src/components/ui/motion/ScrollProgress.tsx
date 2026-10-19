"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";

/** A hairline across the top that fills as the page is read. Hidden for reduced motion. */
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-signal"
    />
  );
}
