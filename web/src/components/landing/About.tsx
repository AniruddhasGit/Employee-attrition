"use client";

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Tag } from "@/components/ui/Tag";

const STATEMENT =
  "Exit interviews tell you why people left. Retain tells you while there is still time to keep them.";

const TAGS = [
  "Quarterly check-ins",
  "Plain-English risk drivers",
  "Action plans that are measured",
  "Fairness audit",
  "No protected inputs",
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
      <div className="grid grid-cols-12 gap-y-10">
        <p className="col-span-12 text-sm text-muted md:col-span-3">About this project</p>
        <div className="col-span-12 md:col-span-9">
          <h2
            id="about-title"
            ref={ref}
            className="max-w-[22ch] text-[clamp(2rem,4.6vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.035em]"
          >
            {reduce
              ? STATEMENT
              : words.map((w, i) => (
                  <Word key={i} word={w} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} />
                ))}
          </h2>
          <Reveal delay={0.1}>
            <p className="mt-8 max-w-[58ch] leading-relaxed text-muted">
              Employees answer a short check-in each quarter. An attrition model, tested on people it
              never saw, turns those answers into a risk score HR can read in plain words, and every
              action HR takes is measured against the next quarter&apos;s answers.
            </p>
          </Reveal>
          <ul className="mt-10 flex flex-wrap gap-2.5">
            {TAGS.map((t, i) => (
              <Reveal as="li" key={t} delay={0.05 * i} y={12}>
                <Tag>{t}</Tag>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
