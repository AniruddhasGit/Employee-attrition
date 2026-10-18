"use client";

import { motion, useReducedMotion } from "motion/react";

const R = 90;
const ARC = Math.PI * R; // half circle length
const PATH = `M 20 110 A ${R} ${R} 0 0 1 200 110`;

function point(frac: number, r = R) {
  const a = Math.PI * (1 - frac);
  return { x: 110 + r * Math.cos(a), y: 110 - r * Math.sin(a) };
}

/** Half-circle gauge. The arc springs to the new score; the flag line is a fixed tick (drawn once it is known). */
export function RiskGauge({ value, before, threshold }: { value: number; before: number; threshold: number | null }) {
  const reduce = useReducedMotion();
  const flagged = threshold !== null && value >= threshold;
  const ghost = point(before);
  const tip = point(value);
  return (
    <svg viewBox="0 0 220 132" className="w-full max-w-[320px] overflow-visible" aria-hidden>
      <path d={PATH} fill="none" stroke="var(--haze)" strokeOpacity="0.55" strokeWidth="12" strokeLinecap="round" />
      <motion.path
        d={PATH}
        fill="none"
        stroke={flagged ? "var(--signal)" : "var(--calm)"}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={ARC}
        initial={reduce ? false : { strokeDashoffset: ARC }}
        animate={{ strokeDashoffset: ARC * (1 - value) }}
        transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.7, bounce: 0.12 }}
      />
      {threshold !== null && <Tick threshold={threshold} />}
      {Math.abs(before - value) > 0.005 && (
        <circle cx={ghost.x} cy={ghost.y} r="4.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5" />
      )}
      <motion.circle
        r="3"
        fill="var(--surface)"
        initial={false}
        animate={{ cx: tip.x, cy: tip.y }}
        transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.7, bounce: 0.12 }}
      />
      <text x="20" y="128" textAnchor="middle" className="tabular fill-[var(--muted)] text-[11px]">
        0%
      </text>
      <text x="200" y="128" textAnchor="middle" className="tabular fill-[var(--muted)] text-[11px]">
        100%
      </text>
    </svg>
  );
}

function Tick({ threshold }: { threshold: number }) {
  const a = point(threshold, R - 13);
  const b = point(threshold, R + 13);
  const label = point(threshold, R + 28);
  return (
    <g>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
      <text x={label.x} y={label.y} dy="0.32em" textAnchor="middle" className="tabular fill-[var(--ink-soft)] text-[11px] font-medium">
        Flag
      </text>
    </g>
  );
}
