"use client";

import {
  ArrowsClockwiseIcon,
  ChatTextIcon,
  HandArrowUpIcon,
  PulseIcon,
  UsersThreeIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Reveal } from "@/components/ui/Reveal";

const STEPS: { n: string; id: string; title: string; who: string; body: string; Icon: PhosphorIcon }[] = [
  {
    n: "01",
    id: "check-in",
    title: "Check in",
    who: "Employees",
    body: "Once a quarter, eight short questions on how work feels, plus what would keep them here. They see their answers, never a score.",
    Icon: ChatTextIcon,
  },
  {
    n: "02",
    id: "predict",
    title: "Predict",
    who: "HR",
    body: "Fresh answers re-score everyone. HR sees who is at risk, why, in plain words, and who dropped sharply since last time.",
    Icon: PulseIcon,
  },
  {
    n: "03",
    id: "act",
    title: "Act",
    who: "HR",
    body: "Pick an action for a person: a pay review, a promotion talk, less overtime. The model estimates the effect before you commit.",
    Icon: HandArrowUpIcon,
  },
  {
    n: "04",
    id: "retain",
    title: "Retain",
    who: "Both",
    body: "Next quarter's check-in shows whether risk really fell. Teams see what changed because of what they said.",
    Icon: UsersThreeIcon,
  },
];

/** The product loop, one step per row; a hairline fills down the rail as you read. */
export function HowItWorks() {
  const list = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: list, offset: ["start 0.75", "end 0.6"] });
  const rail = useTransform(scrollYProgress, (p) => `scaleY(${reduce ? 1 : p})`);

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 py-24 md:px-8 md:py-32">
      <div className="grid grid-cols-12 gap-y-6">
        <p className="col-span-12 flex items-center gap-2 self-start text-sm text-muted md:col-span-3 md:pt-4">
          <span aria-hidden className="h-px w-6 bg-mist" />
          How it works
        </p>
        <Reveal className="col-span-12 md:col-span-9">
          <h2 id="how-title" className="max-w-[20ch] text-[clamp(2rem,4.6vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
            A loop, not a report.
          </h2>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-pretty text-muted">
            Four steps that repeat every quarter, so each round of answers sharpens the next decision.
          </p>
        </Reveal>
      </div>

      <ol ref={list} className="relative mt-16 md:mt-20">
        {/* Progress rail: a static track with a filled line drawn by scroll (transform only). */}
        <span aria-hidden className="absolute bottom-0 left-[21px] top-0 w-px bg-line md:left-[27px]" />
        <motion.span
          aria-hidden
          style={{ transform: rail }}
          className="absolute bottom-0 left-[21px] top-0 w-px origin-top bg-ink md:left-[27px]"
        />
        {STEPS.map(({ n, id, title, who, body, Icon }, i) => (
          <Reveal as="li" key={n} delay={0.05 * i} y={16}>
            <div id={id} className="group relative grid scroll-mt-24 grid-cols-[44px_1fr] gap-x-5 pb-8 md:grid-cols-[56px_1fr] md:gap-x-10 md:pb-16">
              <span className="relative z-10 grid size-11 place-items-center rounded-full border border-line bg-bg text-ink transition-transform duration-300 ease-out group-hover:scale-105 md:size-14">
                <Icon size={20} />
              </span>
              <div className="grid grid-cols-12 gap-y-3 border-b border-line pb-8 md:pb-14">
                <div className="col-span-12 md:col-span-5">
                  <span className="tabular font-mono text-xs text-mist">Step {n}</span>
                  <h3 className="mt-2 text-[clamp(1.75rem,3.2vw,2.75rem)] font-semibold leading-none tracking-[-0.03em]">{title}</h3>
                </div>
                <p className="col-span-12 max-w-[52ch] leading-relaxed text-pretty text-muted md:col-span-5 md:col-start-7 md:pt-6">{body}</p>
                <span className="col-span-12 self-start justify-self-start rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-soft md:col-span-1 md:col-start-12 md:mt-6 md:justify-self-end">
                  {who}
                </span>
              </div>
            </div>
          </Reveal>
        ))}
        <Reveal as="li" y={12}>
          <div className="relative grid grid-cols-[44px_1fr] items-center gap-x-5 md:grid-cols-[56px_1fr] md:gap-x-10">
            <span className="relative z-10 grid size-11 place-items-center rounded-full bg-ink text-bg md:size-14">
              <ArrowsClockwiseIcon size={20} />
            </span>
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">Then again, next quarter.</span> Each loop learns from the one before.
            </p>
          </div>
        </Reveal>
      </ol>
    </section>
  );
}
