"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/motion";

/**
 * A headline whose words rise out of a mask one after another. The full text stays in the DOM
 * for screen readers and search; reduced motion shows it at once.
 */
export function WordReveal({
  text,
  className,
  as = "h1",
  delay = 0,
  onMount = true,
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
  delay?: number;
  onMount?: boolean;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  if (reduce) return <Comp className={className}>{text}</Comp>;
  const words = text.split(" ");
  const play = onMount ? { animate: "shown" } : { whileInView: "shown", viewport: { once: true, amount: 0.5 } };
  return (
    <Comp
      className={className}
      aria-label={text}
      initial="hidden"
      {...play}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.06, delayChildren: delay } } }}
    >
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            variants={{
              hidden: { transform: "translateY(105%)" },
              shown: { transform: "translateY(0%)", transition: { duration: 0.8, ease: EASE_OUT } },
            }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </Comp>
  );
}
