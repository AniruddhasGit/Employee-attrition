"use client";

import { motion, useInView, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { SPRING } from "@/lib/motion";

const R = 90;
const PATH = `M 20 110 A ${R} ${R} 0 0 1 200 110`;
const { stiffness, damping, mass } = SPRING.settle;

function point(frac: number, r = R) {
  const a = Math.PI * (1 - Math.min(1, Math.max(0, frac)));
  return { x: 110 + r * Math.cos(a), y: 110 - r * Math.sin(a) };
}

/**
 * Half-circle gauge. One spring drives both the arc (pathLength) and its end dot, so the dot rides the arc
 * rather than cutting across it. It sweeps up from zero the first time it is seen, then follows each new score.
 */
export function RiskGauge({ value, before, threshold }: { value: number; before: number; threshold: number | null }) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });
  const v = useSpring(reduce ? value : 0, { stiffness, damping, mass });
  const cx = useTransform(v, (f) => point(f).x);
  const cy = useTransform(v, (f) => point(f).y);
  useEffect(() => {
    if (reduce) v.jump(value);
    else if (seen) v.set(value);
  }, [value, seen, reduce, v]);

  const flagged = threshold !== null && value >= threshold;
  const ghost = point(before);
  return (
    <svg ref={ref} viewBox="0 0 220 132" className="w-full max-w-[320px] overflow-visible" aria-hidden>
      <path d={PATH} fill="none" stroke="var(--haze)" strokeOpacity="0.55" strokeWidth="12" strokeLinecap="round" />
      <motion.path
        d={PATH}
        fill="none"
        stroke={flagged ? "var(--signal)" : "var(--calm)"}
        strokeWidth="12"
        strokeLinecap="round"
        style={{ pathLength: v, transition: "stroke 300ms var(--ease-out, ease-out)" }}
      />
      {threshold !== null && <Tick threshold={threshold} />}
      {Math.abs(before - value) > 0.005 && (
        <circle cx={ghost.x} cy={ghost.y} r="4.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5" />
      )}
      <motion.circle r="3" fill="var(--surface)" cx={cx} cy={cy} />
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
