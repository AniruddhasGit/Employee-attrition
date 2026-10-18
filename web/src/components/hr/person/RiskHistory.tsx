"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { pct, signedPct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { TipRow, Tooltip } from "@/components/charts/Tooltip";

type Point = { quarter: string; riskScore: number };

const H = 240;
const PAD = { top: 20, right: 16, bottom: 32, left: 40 };

/** Tracks an element's width so the SVG draws at real pixels (crisp 12px labels at any size). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Risk score per quarter as one line, with the flag line dashed across. Hover or focus a point for detail. */
export function RiskHistory({ history, threshold }: { history: Point[]; threshold: number | null }) {
  const reduce = useReducedMotion();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const top = Math.max(...history.map((h) => h.riskScore), threshold ?? 0);
  const step = top * 1.15 > 0.6 ? 0.2 : 0.1; // round gridlines: every 10 pts, or 20 above 60%
  const domain = Math.min(1, Math.ceil((top * 1.15) / step) * step);
  const ticks = Array.from({ length: Math.round(domain / step) + 1 }, (_, i) => i * step);
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (history.length === 1 ? innerW / 2 : (innerW * i) / (history.length - 1));
  const y = (v: number) => PAD.top + innerH * (1 - v / domain);
  const path = history.map((h, i) => `${i ? "L" : "M"} ${x(i)} ${y(h.riskScore)}`).join(" ");
  const flagged = (v: number) => threshold !== null && v >= threshold;

  function nearest(clientX: number, box: DOMRect) {
    const px = clientX - box.left;
    let best = 0;
    history.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    return best;
  }

  const tip = active === null ? null : history[active];
  const prev = active ? history[active - 1] : null;

  return (
    <div data-testid="risk-history">
      <div
        ref={ref}
        className="relative"
        onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label="Risk score by quarter; the table below lists the values." className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-[var(--muted)] text-[11px]">
                  {pct(t)}
                </text>
              </g>
            ))}

            {threshold !== null && (
              <g>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(threshold)} y2={y(threshold)} stroke="var(--ink)" strokeWidth="1" strokeDasharray="4 4" opacity="0.55" />
                <text x={width - PAD.right} y={y(threshold) - 6} textAnchor="end" className="fill-[var(--ink-soft)] text-[11px]">
                  Flag line {pct(threshold)}
                </text>
              </g>
            )}

            {active !== null && (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--ink)" strokeOpacity="0.18" />
            )}

            <motion.path
              d={path}
              fill="none"
              stroke="var(--series-1)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: EASE_OUT }}
            />

            {history.map((h, i) => (
              <g key={h.quarter}>
                <motion.circle
                  cx={x(i)}
                  cy={y(h.riskScore)}
                  r={active === i ? 6 : 4.5}
                  fill={flagged(h.riskScore) ? "var(--signal)" : "var(--surface)"}
                  stroke={flagged(h.riskScore) ? "var(--signal)" : "var(--series-1)"}
                  strokeWidth="2"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: reduce ? 0 : 0.15 + i * 0.06, ease: EASE_OUT }}
                  tabIndex={0}
                  aria-label={`${h.quarter}: ${pct(h.riskScore)}`}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none focus-visible:stroke-[var(--ink)]"
                />
                <text x={x(i)} y={H - 10} textAnchor="middle" className="tabular fill-[var(--muted)] text-[11px]">
                  {h.quarter}
                </text>
              </g>
            ))}
          </svg>
        )}
        {width === 0 && <div style={{ height: H }} />}

        {tip && active !== null && (
          <Tooltip x={Math.min(Math.max(x(active), 80), width - 80)} y={y(tip.riskScore)}>
            <p className="mb-1.5 font-medium text-ink">{tip.quarter}</p>
            <TipRow label="Risk score" value={pct(tip.riskScore, 1)} swatch="var(--series-1)" />
            {prev && <TipRow label={`Since ${prev.quarter}`} value={signedPct(tip.riskScore - prev.riskScore)} />}
            {threshold !== null && <TipRow label="Flagged" value={flagged(tip.riskScore) ? "Yes" : "No"} />}
          </Tooltip>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-series-1" /> Risk score at each check-in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-signal" /> Above the flag line
        </span>
      </div>

      <details className="group mt-4 text-sm">
        <summary className="cursor-pointer select-none text-muted transition-colors duration-150 hover:text-ink">Show as a table</summary>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-normal">Quarter</th>
              <th className="pb-2 text-right font-normal">Risk score</th>
              <th className="pb-2 text-right font-normal">Change</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {history.map((h, i) => (
              <tr key={h.quarter} className="border-t border-line">
                <td className="py-2">{h.quarter}</td>
                <td className="py-2 text-right">{pct(h.riskScore, 1)}</td>
                <td className="py-2 text-right text-muted">{i ? signedPct(h.riskScore - history[i - 1].riskScore) : "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
