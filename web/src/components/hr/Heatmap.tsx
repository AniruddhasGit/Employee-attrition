"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { HeatCell } from "@/lib/api";
import { int, money, pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { seqColor, seqInk } from "@/lib/scale";
import { TipRow, Tooltip } from "@/components/charts/Tooltip";

type Cell = HeatCell;

/**
 * Department rows, role tiles; colour = average risk on a one-hue ramp, width grows with headcount.
 * Hover, focus or tap a tile for detail. The same numbers are one click away as a plain table.
 */
export function Heatmap({ cells }: { cells: Cell[] }) {
  const reduce = useReducedMotion();
  const [tip, setTip] = useState<{ cell: Cell; x: number; y: number } | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(...cells.map((c) => c.meanRisk));
  const domainMax = Math.ceil(max * 20) / 20; // round up to the next 5%
  const departments = [...new Set(cells.map((c) => c.department))];
  let order = 0;

  return (
    <div className="relative" onMouseLeave={() => setTip(null)}>
      <div className="flex flex-col gap-6 md:gap-3">
        {departments.map((dept) => {
          const row = cells.filter((c) => c.department === dept).sort((a, b) => b.meanRisk - a.meanRisk);
          const people = row.reduce((a, c) => a + c.n, 0);
          return (
            <div key={dept} className="grid grid-cols-12 items-center gap-x-3 gap-y-2.5">
              <p className="col-span-12 flex items-baseline justify-between gap-3 text-sm font-medium md:col-span-2 md:flex-col md:justify-center md:gap-0.5">
                {dept}
                <span className="tabular text-xs font-normal text-muted">{int(people)} people</span>
              </p>
              <ul className="col-span-12 flex flex-wrap gap-[3px] md:col-span-10">
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
                      transition={{ duration: 0.4, delay: Math.min(i, 14) * 0.035, ease: EASE_OUT }}
                      onMouseMove={(e) => {
                        const box = (e.currentTarget.closest(".relative") as HTMLElement).getBoundingClientRect();
                        setTip({ cell: c, x: Math.min(Math.max(e.clientX - box.left, 80), box.width - 80), y: e.clientY - box.top });
                      }}
                      onFocus={(e) => {
                        const box = (e.currentTarget.closest(".relative") as HTMLElement).getBoundingClientRect();
                        const r = e.currentTarget.getBoundingClientRect();
                        setTip({ cell: c, x: Math.min(Math.max(r.left - box.left + r.width / 2, 80), box.width - 80), y: r.top - box.top });
                      }}
                      onBlur={() => setTip(null)}
                      className="flex min-h-24 min-w-[8.5rem] basis-0 cursor-default flex-col justify-between gap-3 rounded-xl p-3 outline-offset-2 md:min-h-28"
                      style={{ background: seqColor(t), color: seqInk(t), flexGrow: Math.sqrt(c.n) }}
                    >
                      <span className="text-pretty text-sm font-medium leading-tight">{c.jobRole}</span>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="tabular text-2xl font-semibold tracking-[-0.02em]">{pct(c.meanRisk)}</span>
                        <span className="tabular text-xs opacity-80">{int(c.n)}</span>
                      </span>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-hidden>
          <span className="flex items-center gap-3">
            <span>0%</span>
            <span className="flex h-2 w-32 overflow-hidden rounded-full sm:w-40">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="flex-1" style={{ background: `var(--seq-${i})` }} />
              ))}
            </span>
            <span>{pct(domainMax)} average risk score</span>
          </span>
          <span>Corner figure: people in the role</span>
        </span>
        <button
          type="button"
          aria-expanded={asTable}
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-ink-soft transition-[background-color,border-color,transform] duration-150 ease-out hover:border-ink/25 hover:bg-surface active:scale-[0.97]"
        >
          {asTable ? "Hide table" : "Show as table"}
        </button>
      </div>

      {asTable && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
          <table data-testid="heatmap-table" className="tabular w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-muted">
                <th className="py-3 pl-4 font-medium md:pl-6">Role</th>
                <th className="hidden py-3 font-medium sm:table-cell">Department</th>
                <th className="py-3 text-right font-medium">People</th>
                <th className="py-3 pr-4 text-right font-medium sm:pr-0">Avg risk</th>
                <th className="hidden py-3 pr-6 text-right font-medium sm:table-cell">Expected cost</th>
              </tr>
            </thead>
            <tbody>
              {[...cells]
                .sort((a, b) => b.meanRisk - a.meanRisk)
                .map((c) => (
                  <tr key={`${c.department}-${c.jobRole}`} className="border-t border-line">
                    <td className="py-2.5 pl-4 md:pl-6">{c.jobRole}</td>
                    <td className="hidden py-2.5 text-muted sm:table-cell">{c.department}</td>
                    <td className="py-2.5 text-right">{int(c.n)}</td>
                    <td className="py-2.5 pr-4 text-right sm:pr-0">{pct(c.meanRisk, 1)}</td>
                    <td className="hidden py-2.5 pr-6 text-right sm:table-cell">{money(c.expectedCost)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

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
