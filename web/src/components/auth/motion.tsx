"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT } from "@/lib/motion";

/** Shared motion for the sign-in and first-password pages. */

/** The dark panel opens out of a slightly inset frame (clip-path), so it arrives as a window, not a fade. */
export function usePanelEnter() {
  const reduce = useReducedMotion();
  return reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } }
    : {
        initial: { opacity: 0, clipPath: "inset(5% 3% 5% 3% round 16px)" },
        animate: { opacity: 1, clipPath: "inset(0% 0% 0% 0% round 16px)" },
        transition: { duration: 0.9, ease: EASE_OUT },
      };
}

/** Form rows rise in one after another, after the headline has started. */
export function useRowEnter() {
  const reduce = useReducedMotion();
  return (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, transform: "translateY(14px)", filter: "blur(3px)" },
          animate: { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
          transition: { duration: 0.6, delay: 0.12 + 0.06 * i, ease: EASE_OUT },
        };
}

/** Button label states cross-fade with a touch of blur, quick enough to read as feedback. */
export function useLabelSwap() {
  const reduce = useReducedMotion();
  return reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : {
        initial: { opacity: 0, filter: "blur(4px)", transform: "translateY(6px)" },
        animate: { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
        exit: { opacity: 0, filter: "blur(4px)", transform: "translateY(-6px)" },
        transition: { duration: 0.2, ease: EASE_OUT },
      };
}

/** A line that opens and closes its own space (height and opacity) instead of shoving the form. */
export function Collapse({ show, children, className }: { show: boolean; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0, transition: { duration: reduce ? 0 : 0.16, ease: EASE_OUT } }}
          transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
          className={`overflow-hidden ${className ?? ""}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A small calm dot with a slow breathing halo: something is alive and working. Still for reduced motion. */
export function BreathingDot({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={`relative flex size-2 shrink-0 ${className ?? ""}`} aria-hidden>
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-full bg-calm"
          initial={{ opacity: 0.5, transform: "scale(1)" }}
          animate={{ opacity: 0, transform: "scale(2.6)" }}
          transition={{ duration: 2.2, ease: EASE_OUT, repeat: Infinity, repeatDelay: 0.4 }}
        />
      )}
      <span className="relative size-2 rounded-full bg-calm" />
    </span>
  );
}

/** An unhurried indeterminate hairline: a soft segment glides along a track. Static track for reduced motion. */
export function PatientBar() {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden className="relative block h-px w-full overflow-hidden bg-line">
      {!reduce && (
        <motion.span
          className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-calm to-transparent"
          initial={{ transform: "translateX(-100%)" }}
          animate={{ transform: "translateX(300%)" }}
          transition={{ duration: 2.4, ease: [0.45, 0, 0.55, 1], repeat: Infinity }}
        />
      )}
    </span>
  );
}
