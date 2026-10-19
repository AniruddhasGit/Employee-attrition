"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT, STAGGER } from "@/lib/motion";

const item: Variants = {
  hidden: { opacity: 0, transform: "translateY(14px)", filter: "blur(4px)" },
  shown: { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)", transition: { duration: 0.55, ease: EASE_OUT } },
};
const still: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.2 } } };

/**
 * A list or grid whose children rise in one after another when it scrolls into view.
 * Wrap each child in <StaggerItem>. `onMount` plays on mount instead (above-the-fold content).
 */
export function Stagger({
  children,
  className,
  as = "div",
  delay = 0,
  gap = STAGGER,
  onMount = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol" | "section" | "dl";
  delay?: number;
  gap?: number;
  onMount?: boolean;
}) {
  const Comp = motion[as];
  const container: Variants = { hidden: {}, shown: { transition: { staggerChildren: gap, delayChildren: delay } } };
  const play = onMount ? { animate: "shown" } : { whileInView: "shown", viewport: { once: true, amount: 0.15 } };
  return (
    <Comp className={className} variants={container} initial="hidden" {...play}>
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "section" | "tr";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp className={className} variants={reduce ? still : item}>
      {children}
    </Comp>
  );
}
