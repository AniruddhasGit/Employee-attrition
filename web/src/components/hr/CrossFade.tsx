"use client";

import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT } from "@/lib/motion";

function Layer({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const present = useIsPresent();
  return (
    <motion.div
      // The leaving layer sits underneath and ignores the pointer, so the new content is clickable at once.
      className={`col-start-1 row-start-1 min-w-0 ${present ? "relative z-[1]" : "pointer-events-none"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.32, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stacks the outgoing and incoming states in one grid cell and fades between them,
 * so a skeleton dissolves into the content it was shaped like instead of popping.
 */
export function CrossFade({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] ${className ?? ""}`}>
      <AnimatePresence initial={false}>
        <Layer key={id}>{children}</Layer>
      </AnimatePresence>
    </div>
  );
}
