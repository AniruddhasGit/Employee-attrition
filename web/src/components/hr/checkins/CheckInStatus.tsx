"use client";

import type { CheckInStatus as Status } from "@/lib/api";
import { pct } from "@/lib/format";
import { CountUp } from "@/components/ui/motion";
import { DepartmentBars } from "./DepartmentBars";

/** This quarter's response rate, with the per-department breakdown. */
export function CheckInStatus({ status }: { status: Status }) {
  const rows = status.byDepartment;
  const total = rows.reduce((s, d) => s + d.total, 0);
  const answered = rows.reduce((s, d) => s + d.answered, 0);
  const waiting = total - answered;
  const rate = (d: Status["byDepartment"][number]) => (d.total ? d.answered / d.total : 1);
  const behind = rows.length > 1 ? [...rows].sort((a, b) => rate(a) - rate(b))[0] : null;

  return (
    <section
      aria-labelledby="rate-title"
      className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 md:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="rate-title" className="text-xl font-semibold tracking-tight">
            Response rate
          </h2>
          <p className="mt-1 text-sm text-muted">Share of people who have answered this quarter.</p>
        </div>
        <span className="tabular shrink-0 rounded-full bg-ink px-2.5 py-1 text-xs text-bg">{status.quarter}</span>
      </div>

      <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-5">
        {/* Counts up from zero the first time it is seen, so the headline lands with the page. */}
        <CountUp
          value={status.responseRate}
          duration={1.1}
          format={(v) => pct(v)}
          testId="response-rate"
          className="text-[clamp(4rem,9vw,6.5rem)] leading-[0.85] font-semibold tracking-[-0.05em]"
        />
        <dl className="flex gap-8 pb-1 text-sm">
          <div>
            <dt className="text-muted">Answered</dt>
            <dd className="tabular mt-0.5 text-xl font-semibold tracking-tight">{answered.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted">Waiting</dt>
            <dd className="tabular mt-0.5 text-xl font-semibold tracking-tight">{waiting.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted">Asked</dt>
            <dd className="tabular mt-0.5 text-xl font-semibold tracking-tight">{total.toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      {behind && behind.total > behind.answered && (
        <p className="mt-6 max-w-lg text-sm leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">{behind.department}</span> has the most ground to make up, with{" "}
          <span className="tabular font-medium text-ink">{behind.total - behind.answered}</span> people still to answer.
        </p>
      )}

      <div className="mt-8 flex-1 border-t border-line pt-7">
        <DepartmentBars rows={rows} average={total ? answered / total : 0} />
      </div>
    </section>
  );
}
