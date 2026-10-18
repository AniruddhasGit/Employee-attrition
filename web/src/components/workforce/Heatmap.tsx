"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Workforce } from "@/lib/api";
import { int, money, pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { seqColor, seqInk } from "@/lib/scale";
import { TipRow, Tooltip } from "@/components/charts/Tooltip";

type Cell = Workforce["heatmap"][number];

/** Department rows, role cells; colour = average risk on a one-hue ramp. Hover for detail. */
export function Heatmap({ cells }: { cells: Cell[] }) {
  const reduce = useReducedMotion();
  const [tip, setTip] = useState<{ cell: Cell; x: number; y: number } | null>(null);
  const max = Math.max(...cells.map((c) => c.meanRisk));
  const domainMax = Math.ceil(max * 20) / 20; // round up to the next 5%
  const departments = [...new Set(cells.map((c) => c.department))];
  let order = 0;

  return (
    <div className="relative" onMouseLeave={() => setTip(null)}>
      <div className="flex flex-col gap-6">
        {departments.map((dept) => {
          const row = cells.filter((c) => c.department === dept).sort((a, b) => b.meanRisk - a.meanRisk);
          return (
            <div key={dept} className="grid grid-cols-12 items-start gap-3">
              <p className="col-span-12 text-sm font-medium md:col-span-2 md:pt-3">{dept}</p>
              <ul className="col-span-12 grid grid-cols-2 gap-[2px] sm:grid-cols-3 md:col-span-10 md:grid-cols-5">
                {row.map((c) => {
                  const t = c.meanRisk / domainMax;
                  const i = order++;
                  return (
                    <motion.li
                      key={c.jobRole}
                      data-testid="heat-cell"
                      tabIndex={0}
                      aria-label={`${c.jobRole} in ${dept}: average risk ${pct(c.meanRisk)}, ${c.n} people`}
                      initial={{ opacity: 0, transform: reduce ? "none" : "scale(0.96)" }}
                      whileInView={{ opacity: 1, transform: "scale(1)" }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.4, delay: i * 0.035, ease: EASE_OUT }}
                      onMouseMove={(e) => {
                        const box = (e.currentTarget.closest(".relative") as HTMLElement).getBoundingClientRect();
                        setTip({ cell: c, x: e.clientX - box.left, y: e.clientY - box.top });
                      }}
                      onFocus={(e) => {
                        const box = (e.currentTarget.closest(".relative") as HTMLElement).getBoundingClientRect();
                        const r = e.currentTarget.getBoundingClientRect();
                        setTip({ cell: c, x: r.left - box.left + r.width / 2, y: r.top - box.top });
                      }}
                      onBlur={() => setTip(null)}
                      className="flex min-h-24 cursor-default flex-col justify-between rounded-[4px] p-3 outline-offset-2 first:rounded-l-xl last:rounded-r-xl"
                      style={{ background: seqColor(t), color: seqInk(t) }}
                    >
                      <span className="text-sm leading-tight">{c.jobRole}</span>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="tabular text-xl font-semibold">{pct(c.meanRisk)}</span>
                        <span className="tabular text-xs">n {c.n}</span>
                      </span>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span>0%</span>
        <span className="flex h-2 w-40 overflow-hidden rounded-full">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="flex-1" style={{ background: `var(--seq-${i})` }} />
          ))}
        </span>
        <span>{pct(domainMax)} average risk score</span>
      </div>

      {tip && (
        <Tooltip x={tip.x} y={tip.y}>
          <p className="mb-1.5 font-medium text-ink">{tip.cell.jobRole}</p>
          <TipRow label="People" value={int(tip.cell.n)} />
          <TipRow label="Average risk" value={pct(tip.cell.meanRisk, 1)} />
          <TipRow label="Expected cost" value={money(tip.cell.expectedCost)} />
        </Tooltip>
      )}
    </div>
  );
}
