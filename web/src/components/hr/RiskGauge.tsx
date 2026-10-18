"use client";

import { motion, useReducedMotion } from "motion/react";

const R = 90;
const ARC = Math.PI * R; // half circle length

function point(frac: number, r = R) {
  const a = Math.PI * (1 - frac);
  return { x: 110 + r * Math.cos(a), y: 110 - r * Math.sin(a) };
}

/** Half-circle gauge. The arc springs to the new score; the flag line is a fixed tick. */
export function RiskGauge({ value, before, threshold }: { value: number; before: number; threshold: number }) {
  const reduce = useReducedMotion();
  const tickIn = point(threshold, R - 12);
  const tickOut = point(threshold, R + 12);
  const ghost = point(before);
  return (
    <svg viewBox="0 0 220 124" className="w-full max-w-[360px]" aria-hidden>
      <path d={`M 20 110 A ${R} ${R} 0 0 1 200 110`} fill="none" stroke="var(--line)" strokeWidth="10" strokeLinecap="round" />
      <motion.path
        d={`M 20 110 A ${R} ${R} 0 0 1 200 110`}
        fill="none"
        stroke={value >= threshold ? "var(--signal)" : "var(--calm)"}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={ARC}
        initial={false}
        animate={{ strokeDashoffset: ARC * (1 - value) }}
        transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.6, bounce: 0.15 }}
      />
      <line x1={tickIn.x} y1={tickIn.y} x2={tickOut.x} y2={tickOut.y} stroke="var(--ink)" strokeWidth="1.5" />
      {Math.abs(before - value) > 0.005 && <circle cx={ghost.x} cy={ghost.y} r="4" fill="var(--bg)" stroke="var(--ink)" strokeWidth="1.5" />}
    </svg>
  );
}
