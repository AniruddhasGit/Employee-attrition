"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { SPRING } from "@/lib/motion";

/**
 * A card that lifts a few pixels and deepens its shadow under a fine pointer, and presses in on tap.
 * Use for clickable cards and rows; static content should not move.
 */
export function Lift({
  children,
  className,
  as = "div",
  lift = 3,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li";
  lift?: number;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  if (reduce) return <Comp className={className}>{children}</Comp>;
  return (
    <Comp
      className={`transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgb(14_17_22/0.45)] ${className ?? ""}`}
      whileHover={{ y: -lift }}
      whileTap={{ scale: 0.985 }}
      transition={SPRING.soft}
    >
      {children}
    </Comp>
  );
}
