"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { HeroHaze } from "./HeroHaze";
import { PillButton } from "@/components/ui/PillButton";
import { EASE_IN_OUT, EASE_OUT } from "@/lib/motion";

const INDEX = [
  { n: "01", label: "Check in", href: "#check-in" },
  { n: "02", label: "Predict", href: "#predict" },
  { n: "03", label: "Act", href: "#act" },
  { n: "04", label: "Retain", href: "#retain" },
];

/** Letters rise out of a mask, staggered. Words never break mid-word. */
function Letters({ text, delay, reduce }: { text: string; delay: number; reduce: boolean }) {
  let index = 0;
  return (
    <span aria-hidden className="inline-flex flex-wrap gap-x-[0.22em]">
      {text.split(" ").map((word) => (
        <span key={word} className="inline-block overflow-hidden whitespace-nowrap pb-[0.06em]">
          {[...word].map((ch) => {
            const i = index++;
            return (
              <motion.span
                key={i}
                className="inline-block"
                initial={reduce ? { opacity: 0 } : { transform: "translateY(105%)" }}
                animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
                transition={{ duration: 0.9, delay: delay + i * 0.035, ease: EASE_OUT }}
              >
                {ch}
              </motion.span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

export function Hero() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement>(null);
  // Parallax on the way out: type lifts and fades faster than the mist drifts.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentTransform = useTransform(scrollYProgress, (v) => (reduce ? "none" : `translateY(${v * -120}px)`));
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, reduce ? 1 : 0]);
  const hazeTransform = useTransform(scrollYProgress, (v) => (reduce ? "none" : `translateY(${v * 80}px) scale(${1 + v * 0.06})`));

  return (
    <section ref={ref} aria-labelledby="hero-title" className="p-2">
      <div className="relative isolate flex min-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_70%_20%,var(--hero-c)_0%,var(--hero-a)_45%,var(--hero-b)_100%)]">
        <motion.div className="absolute inset-0" style={{ transform: hazeTransform }}>
          <HeroHaze />
        </motion.div>

        {/* A single drawn arc, echoing the orbit the particles leave along. */}
        <svg
          aria-hidden
          viewBox="0 0 600 600"
          className="pointer-events-none absolute left-[18%] top-[16%] h-[64%] w-auto opacity-60 max-md:hidden"
        >
          <motion.ellipse
            cx="300"
            cy="300"
            rx="210"
            ry="270"
            fill="none"
            stroke="var(--surface)"
            strokeWidth="1"
            transform="rotate(-24 300 300)"
            initial={{ pathLength: reduce ? 1 : 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2.2, delay: 0.4, ease: EASE_IN_OUT }}
          />
        </svg>

        <motion.div
          style={{ transform: contentTransform, opacity: contentOpacity }}
          className="relative z-10 mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-12 content-end gap-y-10 px-4 pb-8 pt-28 md:px-8 md:pb-10"
        >
          <nav aria-label="Features" className="col-span-12 md:col-span-4 md:col-start-9 md:row-start-1 md:self-start">
            <ol className="flex flex-col gap-3">
              {INDEX.map((item, i) => (
                <motion.li
                  key={item.n}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.9 + i * 0.08, ease: EASE_OUT }}
                >
                  <Link href={item.href} className="group flex items-center gap-3 text-sm">
                    <span className="tabular font-mono text-xs text-ink-soft">{`//${item.n}`}</span>
                    <motion.span
                      aria-hidden
                      className="h-px flex-1 origin-left bg-ink/40"
                      initial={{ transform: reduce ? "scaleX(1)" : "scaleX(0)" }}
                      animate={{ transform: "scaleX(1)" }}
                      transition={{ duration: 0.8, delay: 1 + i * 0.08, ease: EASE_OUT }}
                    />
                    <span className="font-medium transition-transform duration-200 ease-out group-hover:-translate-x-1">
                      {item.label}
                    </span>
                  </Link>
                </motion.li>
              ))}
            </ol>
          </nav>

          <h1 id="hero-title" className="sr-only">Why people leave</h1>
          <div className="col-span-12 grid grid-cols-12 font-semibold uppercase leading-[0.86] tracking-[-0.05em]">
            <div className="col-span-12 flex flex-col items-end gap-5 md:col-span-7 md:col-start-6 md:row-start-1 md:mb-6">
              <span aria-hidden className="text-[clamp(3.25rem,11vw,10.5rem)]">
                <Letters text="Leave." delay={0.35} reduce={reduce} />
              </span>
              <motion.div
                className="normal-case tracking-normal"
                initial={{ opacity: 0, transform: reduce ? "none" : "translateY(12px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.6, delay: 1.1, ease: EASE_OUT }}
              >
                <PillButton href="/login">Sign in</PillButton>
              </motion.div>
            </div>
            <div className="col-span-12 md:row-start-2">
              <motion.p
                className="mb-5 block max-w-[34ch] text-sm font-normal normal-case leading-relaxed tracking-normal text-ink-soft md:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.8, ease: EASE_OUT }}
              >
                Quarterly check-ins, an honest model and a plan for every person at risk, so you
                keep the people you&apos;d hate to lose.
              </motion.p>
              <span aria-hidden className="block text-[clamp(3.25rem,11vw,10.5rem)]">
                <Letters text="Why people" delay={0} reduce={reduce} />
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
