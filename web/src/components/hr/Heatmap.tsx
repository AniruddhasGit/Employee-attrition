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
 * Department rows, role cells; colour = average risk on a one-hue ramp. Hover for detail.
 * The same numbers are one click away as a plain table.
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
                      className="flex min-h-24 cursor-default flex-col justify-between rounded-lg p-3 outline-offset-2"
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
        <span className="flex items-center gap-3" aria-hidden>
          <span>0%</span>
          <span className="flex h-2 w-40 overflow-hidden rounded-full">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} className="flex-1" style={{ background: `var(--seq-${i})` }} />
            ))}
          </span>
          <span>{pct(domainMax)} average risk score</span>
        </span>
        <button
          type="button"
          aria-expanded={asTable}
          onClick={() => setAsTable((v) => !v)}
          className="rounded-full border border-line px-3 py-1 text-ink-soft transition-[background-color,transform] duration-150 ease-out hover:bg-surface active:scale-[0.97]"
        >
          {asTable ? "Hide table" : "Show as table"}
        </button>
      </div>

      {asTable && (
        <table data-testid="heatmap-table" className="tabular mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-normal">Role</th>
              <th className="hidden pb-2 font-normal sm:table-cell">Department</th>
              <th className="pb-2 text-right font-normal">People</th>
              <th className="pb-2 text-right font-normal">Avg risk</th>
              <th className="hidden pb-2 text-right font-normal sm:table-cell">Expected cost</th>
            </tr>
          </thead>
          <tbody>
            {[...cells]
              .sort((a, b) => b.meanRisk - a.meanRisk)
              .map((c) => (
                <tr key={`${c.department}-${c.jobRole}`} className="border-t border-line">
                  <td className="py-2">{c.jobRole}</td>
                  <td className="hidden py-2 text-muted sm:table-cell">{c.department}</td>
                  <td className="py-2 text-right">{int(c.n)}</td>
                  <td className="py-2 text-right">{pct(c.meanRisk, 1)}</td>
                  <td className="hidden py-2 text-right sm:table-cell">{money(c.expectedCost)}</td>
                </tr>
              ))}
          </tbody>
        </table>
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
