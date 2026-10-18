"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Workforce } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { TipRow, Tooltip } from "@/components/charts/Tooltip";

const W = 720;
const H = 240;
const PAD = { l: 36, r: 8, t: 12, b: 28 };

/** Histogram of risk scores; bars at or above the flag line take the second series colour. */
export function RiskDistribution({ bins, threshold }: { bins: Workforce["distribution"]; threshold: number }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...bins.map((b) => b.count));
  const yMax = Math.ceil(max / 200) * 200; // round axis to a clean step
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const bw = iw / bins.length;
  const x = (v: number) => PAD.l + v * iw;
  const y = (c: number) => PAD.t + ih - (c / yMax) * ih;
  const ticks = [0, yMax / 2, yMax];
  const hb = hover !== null ? bins[hover] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-series-1" />Below the flag line</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-series-2" />At or above it</span>
      </div>
      <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Number of employees by risk score">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="fill-muted text-[10px]">{t}</text>
          </g>
        ))}
        {bins.map((b, i) => {
          const above = b.bin + 0.025 >= threshold; // bin centre at or past the flag line
          const h = (b.count / yMax) * ih;
          return (
            <g key={b.bin} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x(b.bin)} y={PAD.t} width={bw} height={ih} fill="transparent" />
              <motion.rect
                x={x(b.bin) + 1}
                width={Math.max(bw - 2, 1)}
                y={PAD.t + ih - h}
                height={h}
                rx={Math.min(4, h / 2)}
                fill={above ? "var(--series-2)" : "var(--series-1)"}
                opacity={hover === null || hover === i ? 1 : 0.45}
                style={{ transformOrigin: `0px ${PAD.t + ih}px`, transformBox: "view-box" }}
                initial={{ transform: reduce ? "scaleY(1)" : "scaleY(0)" }}
                whileInView={{ transform: "scaleY(1)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.02, ease: EASE_OUT }}
              />
            </g>
          );
        })}
        <line x1={x(threshold)} x2={x(threshold)} y1={PAD.t - 4} y2={PAD.t + ih} stroke="var(--ink)" strokeDasharray="3 3" />
        <text x={x(threshold) + 6} y={PAD.t + 8} className="fill-ink text-[10px]">flag line {pct(threshold)}</text>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text key={v} x={x(v)} y={H - 8} textAnchor={v === 1 ? "end" : v === 0 ? "start" : "middle"} className="fill-muted text-[10px]">{pct(v)}</text>
        ))}
      </svg>
      {hb && (
        <Tooltip x={`${((x(hb.bin) + bw / 2) / W) * 100}%`} y={`${(y(hb.count) / H) * 100}%`}>
          <TipRow label={`${pct(hb.bin)} to ${pct(hb.bin + 0.05)}`} value={`${int(hb.count)} people`} />
        </Tooltip>
      )}
      </div>
    </div>
  );
}
