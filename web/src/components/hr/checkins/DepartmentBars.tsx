"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { CheckInStatus } from "@/lib/api";
import { pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { TipRow, Tooltip } from "@/components/charts/Tooltip";

type Row = CheckInStatus["byDepartment"][number];

/** One horizontal bar per department: the answered share, labelled with the counts. */
export function DepartmentBars({ rows }: { rows: Row[] }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-calm" />
          Answered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-haze" />
          Waiting
        </span>
      </div>
      <ul className="space-y-5" aria-hidden>
        {rows.map((r, i) => {
          const share = r.total ? r.answered / r.total : 0;
          return (
            <li
              key={r.department}
              data-testid="dept-bar"
              className="relative"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{r.department}</span>
                <span className="tabular shrink-0 text-muted">
                  {r.answered} of {r.total} answered
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-haze/60">
                <motion.div
                  className="h-full origin-left rounded-full bg-calm"
                  style={{ width: `${share * 100}%` }}
                  initial={{ transform: reduce ? "scaleX(1)" : "scaleX(0)" }}
                  whileInView={{ transform: "scaleX(1)" }}
                  viewport={{ once: true }}
                  transition={reduce ? { duration: 0 } : { duration: 0.45, delay: 0.1 + i * 0.06, ease: EASE_OUT }}
                />
              </div>
              {hover === i && (
                <Tooltip x={`${Math.max(share * 100, 12)}%`} y={28}>
                  <p className="mb-1 font-medium text-ink">{r.department}</p>
                  <TipRow label="Answered" value={String(r.answered)} swatch="var(--calm)" />
                  <TipRow label="Waiting" value={String(r.total - r.answered)} swatch="var(--haze)" />
                  <TipRow label="Rate" value={pct(share)} />
                </Tooltip>
              )}
            </li>
          );
        })}
      </ul>
      <table className="sr-only">
        <caption>Check-ins answered by department</caption>
        <thead>
          <tr>
            <th scope="col">Department</th>
            <th scope="col">Answered</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.department}>
              <th scope="row">{r.department}</th>
              <td>{r.answered}</td>
              <td>{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
