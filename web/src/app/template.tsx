"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT } from "@/lib/motion";

/** Every route enters with a short rise; a touch of blur hides the crossfade seam. */
export default function Template({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px)", filter: "blur(4px)" }}
      animate={
        reduce
          ? { opacity: 1 }
          : {
              opacity: 1,
              transform: "translateY(0px)",
              filter: "blur(0px)",
              // Clear both afterwards so they never create a containing block for fixed/sticky content.
              transitionEnd: { transform: "none", filter: "none" },
            }
      }
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
