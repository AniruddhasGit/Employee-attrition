import type { CheckInStatus as Status } from "@/lib/api";
import { pct } from "@/lib/format";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { DepartmentBars } from "./DepartmentBars";

/** This quarter's response rate, with the per-department breakdown. */
export function CheckInStatus({ status }: { status: Status }) {
  const total = status.byDepartment.reduce((s, d) => s + d.total, 0);
  const answered = status.byDepartment.reduce((s, d) => s + d.answered, 0);

  return (
    <section aria-labelledby="rate-title" className="rounded-2xl border border-line bg-surface p-6 md:p-8">
      <h2 id="rate-title" className="text-sm text-muted">
        Response rate · {status.quarter}
      </h2>
      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
        <AnimatedNumber
          value={status.responseRate}
          format={(v) => pct(v)}
          testId="response-rate"
          className="text-6xl font-semibold tracking-tight md:text-7xl"
        />
        <p className="max-w-xs pb-2 text-sm leading-relaxed text-muted">
          <span className="tabular text-ink">{answered}</span> of <span className="tabular text-ink">{total}</span>{" "}
          people have checked in this quarter.
        </p>
      </div>
      <div className="mt-10">
        <DepartmentBars rows={status.byDepartment} />
      </div>
    </section>
  );
}
