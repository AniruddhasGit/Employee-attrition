"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { HeroCrowd } from "./HeroCrowd";
import { PillButton } from "@/components/ui/PillButton";
import { WordReveal } from "@/components/ui/motion";
import { EASE_OUT, SPRING, STAGGER } from "@/lib/motion";

const INDEX = [
  { n: "01", label: "Check in", href: "#check-in" },
  { n: "02", label: "Predict", href: "#predict" },
  { n: "03", label: "Act", href: "#act" },
  { n: "04", label: "Retain", href: "#retain" },
];

/**
 * Entrance score, in seconds. The headline lands first, then the line that explains it,
 * then the way in, then the index: one read, top of the eye to the bottom.
 */
const CUE = { crowd: 0, why: 0.1, leave: 0.28, sub: 0.55, cta: 0.7, index: 0.8 } as const;

export function Hero() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement>(null);
  // Parallax on the way out: type lifts and fades faster than the crowd drifts.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentTransform = useTransform(scrollYProgress, (v) => (reduce ? "none" : `translateY(${v * -120}px)`));
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, reduce ? 1 : 0]);
  const hazeTransform = useTransform(scrollYProgress, (v) => (reduce ? "none" : `translateY(${v * 80}px) scale(${1 + v * 0.06})`));

  return (
    <section ref={ref} aria-labelledby="hero-title" className="p-2">
      <div className="relative isolate flex min-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_70%_20%,var(--hero-c)_0%,var(--hero-a)_45%,var(--hero-b)_100%)]">
        <motion.div className="absolute inset-0" style={{ transform: hazeTransform }}>
          {/* The crowd surfaces out of the haze rather than popping in with the first paint. */}
          <motion.div
            className="absolute inset-0"
            initial={reduce ? false : { opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.1, delay: CUE.crowd, ease: EASE_OUT }}
          >
            <HeroCrowd />
          </motion.div>
        </motion.div>

        <motion.div
          style={{ transform: contentTransform, opacity: contentOpacity }}
          className="relative z-10 mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-12 content-end gap-y-10 px-4 pb-8 pt-28 md:px-8 md:pb-10"
        >
          <nav aria-label="Features" className="col-span-12 md:col-span-4 md:col-start-9 md:row-start-1 md:self-start">
            <ol className="flex flex-col gap-3">
              {INDEX.map((item, i) => (
                <motion.li
                  key={item.n}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  transition={{ duration: 0.5, delay: CUE.index + i * STAGGER, ease: EASE_OUT }}
                >
                  <Link href={item.href} className="group flex items-center gap-3 text-sm">
                    <span className="tabular font-mono text-xs text-ink-soft">{`//${item.n}`}</span>
                    <motion.span
                      aria-hidden
                      className="h-px flex-1 origin-left bg-ink/40"
                      initial={{ transform: reduce ? "scaleX(1)" : "scaleX(0)" }}
                      animate={{ transform: "scaleX(1)" }}
                      transition={{ duration: 0.8, delay: CUE.index + 0.1 + i * STAGGER, ease: EASE_OUT }}
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
              <div aria-hidden className="text-[clamp(3.25rem,11vw,10.5rem)]">
                <WordReveal as="p" text="Leave." delay={CUE.leave} />
              </div>
              <motion.div
                className="normal-case tracking-normal"
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px) scale(0.96)" }}
                animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
                transition={reduce ? { duration: 0.3 } : { ...SPRING.soft, delay: CUE.cta }}
              >
                <PillButton href="/login">Sign in</PillButton>
              </motion.div>
            </div>
            <div className="col-span-12 md:row-start-2">
              <motion.p
                className="mb-5 block max-w-[34ch] text-sm font-normal normal-case leading-relaxed tracking-normal text-ink-soft md:text-base"
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px)", filter: "blur(4px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }}
                transition={{ duration: 0.7, delay: CUE.sub, ease: EASE_OUT }}
              >
                Quarterly check-ins, an honest model and a plan for every person at risk, so you
                keep the people you&apos;d hate to lose.
              </motion.p>
              <div aria-hidden className="block text-[clamp(3.25rem,11vw,10.5rem)]">
                <WordReveal as="p" text="Why people" delay={CUE.why} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
