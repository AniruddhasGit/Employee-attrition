"use client";

import { useState } from "react";
import type { Metrics } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { TipRow, Tooltip } from "@/components/charts/Tooltip";

const S = 300;
const PAD = 48;

/** Predicted risk vs. how often people in that bin actually left. Dot area = people. */
export function CalibrationPlot({ bins }: { bins: Metrics["calibration"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(0.5, Math.ceil(Math.max(...bins.flatMap((b) => [b.mean_pred, b.frac_pos])) * 10) / 10);
  const inner = S - PAD * 2;
  const pos = (v: number) => (v / top) * inner;
  const maxN = Math.max(...bins.map((b) => b.n));
  const hb = hover !== null ? bins[hover] : null;

  return (
    <div className="relative mx-auto max-w-md">
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full" role="img" aria-label="Calibration: predicted risk against actual leave rate">
        <rect x={PAD} y={PAD} width={inner} height={inner} fill="none" stroke="var(--line)" />
        <line x1={PAD} y1={S - PAD} x2={S - PAD} y2={PAD} stroke="var(--muted)" strokeDasharray="3 4" />
        <text x={S - PAD - 6} y={S - PAD - 8} textAnchor="end" className="fill-muted text-[10px]">dashed line = perfect calibration</text>
        {[0, top / 2, top].map((v) => (
          <g key={v}>
            <text x={PAD + pos(v)} y={S - PAD + 16} textAnchor="middle" className="fill-muted text-[10px]">{pct(v)}</text>
            <text x={PAD - 6} y={S - PAD - pos(v) + 3} textAnchor="end" className="fill-muted text-[10px]">{pct(v)}</text>
          </g>
        ))}
        {bins.map((b, i) => (
          <circle
            key={i}
            cx={PAD + pos(b.mean_pred)}
            cy={S - PAD - pos(b.frac_pos)}
            r={4 + 8 * Math.sqrt(b.n / maxN)}
            fill="var(--series-1)"
            fillOpacity={hover === null || hover === i ? 0.85 : 0.35}
            stroke="var(--surface)"
            strokeWidth="2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={S / 2} y={S - 4} textAnchor="middle" className="fill-ink text-[11px]">Predicted risk</text>
        <text x={12} y={S / 2} textAnchor="middle" transform={`rotate(-90 12 ${S / 2})`} className="fill-ink text-[11px]">Actually left</text>
      </svg>
      {hb && (
        <Tooltip x={`${((PAD + pos(hb.mean_pred)) / S) * 100}%`} y={`${((S - PAD - pos(hb.frac_pos)) / S) * 100}%`}>
          <TipRow label="Predicted" value={pct(hb.mean_pred, 1)} />
          <TipRow label="Actually left" value={pct(hb.frac_pos, 1)} />
          <TipRow label="People" value={int(hb.n)} />
        </Tooltip>
      )}
    </div>
  );
}
