"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { HeroCrowd } from "@/components/landing/HeroCrowd";
import { EASE_OUT } from "@/lib/motion";

/** Fictional answers to the check-in's last question. */
const ANSWERS = [
  { text: "Two remote days a week would make a big difference.", team: "Sales" },
  { text: "A clear path to senior, written down, not just promised.", team: "Research & Development" },
  { text: "Fewer late releases. I want my evenings back.", team: "Research & Development" },
  { text: "A manager who asks how I am before asking for the numbers.", team: "Human Resources" },
  { text: "Pay that keeps up with what people with my skills earn elsewhere.", team: "Sales" },
  { text: "Less travel. Three trips a month is too many.", team: "Sales" },
] as const;

const EVERY_MS = 5200;

/**
 * The dark half of the sign-in page: the landing crowd running behind, and over it one
 * anonymous check-in answer at a time. Rotation pauses off-screen and in hidden tabs;
 * reduced motion shows the first answer, still.
 */
export function CheckInPanel() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % ANSWERS.length);
    }, EVERY_MS);
    return () => window.clearInterval(id);
  }, [reduce, inView]);

  const answer = ANSWERS[index];

  return (
    <div
      ref={ref}
      className="relative isolate flex h-64 flex-col justify-end overflow-hidden rounded-2xl bg-night p-5 text-night-ink sm:h-72 sm:p-8 lg:h-full lg:min-h-[560px] lg:p-12"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <HeroCrowd />
      </div>
      {/* Keeps the words legible where they sit over the crowd. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-night from-45% via-night/70 to-transparent sm:h-3/4 sm:from-0% sm:via-night/80"
      />

      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-night-ink/60">
        <span aria-hidden className="size-1.5 rounded-full bg-signal" />
        <span className="hidden sm:inline">Quarterly check-in ·</span> What would keep you here?
      </p>

      <figure className="mt-3 grid sm:mt-5">
        <AnimatePresence initial={false}>
          <motion.div
            key={index}
            className="[grid-area:1/1]"
            initial={{ opacity: 0, filter: "blur(6px)", transform: "translateY(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)", transform: "translateY(-4px)" }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
          >
            <blockquote className="max-w-[24ch] text-balance text-xl font-medium leading-snug tracking-[-0.02em] sm:text-3xl lg:text-[2.6rem] lg:leading-[1.1]">
              &ldquo;{answer.text}&rdquo;
            </blockquote>
            <figcaption className="mt-3 text-sm text-night-ink/60 sm:mt-5">
              Anonymous answer, {answer.team}
            </figcaption>
          </motion.div>
        </AnimatePresence>
      </figure>

      <div aria-hidden className="mt-5 hidden gap-1.5 sm:flex lg:mt-8">
        {ANSWERS.map((a, i) => (
          <span
            key={a.text}
            className={`h-0.5 w-6 rounded-full transition-colors duration-500 ${i === index ? "bg-night-ink" : "bg-night-ink/20"}`}
          />
        ))}
      </div>
    </div>
  );
}
