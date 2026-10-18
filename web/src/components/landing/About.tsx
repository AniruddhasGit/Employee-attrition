"use client";

import {
  CalendarCheckIcon,
  ChatsCircleIcon,
  ChartLineUpIcon,
  EyeSlashIcon,
  ScalesIcon,
  TextAaIcon,
} from "@phosphor-icons/react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Tag } from "@/components/ui/Tag";

const STATEMENT =
  "Exit interviews tell you why people left. Retain tells you while there is still time to keep them.";

const TAGS = [
  { label: "Quarterly check-ins", Icon: CalendarCheckIcon },
  { label: "Plain-English risk drivers", Icon: TextAaIcon },
  { label: "Action plans that are measured", Icon: ChartLineUpIcon },
  { label: "Fairness audit", Icon: ScalesIcon },
  { label: "No protected inputs", Icon: EyeSlashIcon },
];

const PRINCIPLES = [
  {
    title: "It listens first",
    body: "Eight short questions a quarter, in people's own words. The signal starts with them, not with a spreadsheet.",
    Icon: ChatsCircleIcon,
  },
  {
    title: "It explains itself",
    body: "Every score comes with the reasons behind it, written as sentences HR can act on in a one-to-one.",
    Icon: TextAaIcon,
  },
  {
    title: "It proves its work",
    body: "Actions are checked against the next quarter's answers, so you learn what actually keeps people.",
    Icon: ChartLineUpIcon,
  },
];

function Word({ word, range, progress }: { word: string; range: [number, number]; progress: MotionValue<number> }) {
  // Floor of 0.45 keeps unrevealed words at WCAG AA large-text contrast in both themes.
  const opacity = useTransform(progress, range, [0.45, 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block whitespace-pre">
      {word}{" "}
    </motion.span>
  );
}

export function About() {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.35"] });
  const words = STATEMENT.split(" ");

  return (
    <section aria-labelledby="about-title" className="mx-auto max-w-[1400px] px-4 py-24 md:px-8 md:py-36">
      <div className="grid grid-cols-12 gap-y-8">
        <p className="col-span-12 flex items-center gap-2 self-start text-sm text-muted md:col-span-3 md:pt-4">
          <span aria-hidden className="h-px w-6 bg-mist" />
          Why Retain
        </p>
        <div className="col-span-12 md:col-span-9">
          <h2
            id="about-title"
            ref={ref}
            className="max-w-[22ch] text-[clamp(2rem,4.6vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-balance"
          >
            {reduce
              ? STATEMENT
              : words.map((w, i) => (
                  <Word key={i} word={w} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} />
                ))}
          </h2>
          <Reveal delay={0.1}>
            <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-pretty text-muted">
              Employees answer a short check-in each quarter. An attrition model, tested on people it
              never saw, turns those answers into a risk score HR can read in plain words, and every
              action HR takes is measured against the next quarter&apos;s answers.
            </p>
          </Reveal>
          <ul className="mt-10 flex flex-wrap gap-2.5">
            {TAGS.map(({ label, Icon }, i) => (
              <Reveal as="li" key={label} delay={0.05 * i} y={12}>
                <Tag icon={<Icon size={14} />}>{label}</Tag>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>

      <ul className="mt-20 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:mt-28 md:grid-cols-3">
        {PRINCIPLES.map(({ title, body, Icon }, i) => (
          <Reveal as="li" key={title} delay={0.06 * i} y={16} className="group bg-bg">
            <div className="flex h-full flex-col gap-6 p-6 transition-colors duration-300 md:gap-10 md:p-8 hover:bg-surface">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink transition-transform duration-300 ease-out group-hover:-rotate-6">
                  <Icon size={20} />
                </span>
                <span className="tabular font-mono text-xs text-mist">0{i + 1}</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.02em]">{title}</h3>
                <p className="mt-2 max-w-[38ch] leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
