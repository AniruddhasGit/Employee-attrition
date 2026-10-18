"use client";

import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import type { Answers, Person } from "@/lib/api";

type Key = keyof Answers;

const LEVEL = ["Low", "Medium", "High", "Very high"];
const BALANCE = ["Bad", "Good", "Better", "Best"];
const TRAVEL: Record<Answers["businessTravel"], string> = {
  "Non-Travel": "Not at all",
  Travel_Rarely: "Now and then",
  Travel_Frequently: "Often",
};
const TRAVEL_ORDER: Answers["businessTravel"][] = ["Non-Travel", "Travel_Rarely", "Travel_Frequently"];

/** Short row labels for the same eight questions the employee answers. */
const ROWS: { key: Key; label: string }[] = [
  { key: "environmentSatisfaction", label: "Work environment" },
  { key: "jobSatisfaction", label: "The job itself" },
  { key: "relationshipSatisfaction", label: "Working relationships" },
  { key: "workLifeBalance", label: "Work-life balance" },
  { key: "jobInvolvement", label: "Involvement" },
  { key: "overTime", label: "Overtime" },
  { key: "businessTravel", label: "Travel" },
  { key: "trainingTimesLastYear", label: "Training sessions" },
];

function show(key: Key, v: Answers[Key]): string {
  if (key === "workLifeBalance") return BALANCE[Number(v) - 1];
  if (key === "businessTravel") return TRAVEL[v as Answers["businessTravel"]];
  if (key === "overTime") return v === "Yes" ? "Yes" : "No";
  if (key === "trainingTimesLastYear") return Number(v) >= 6 ? "6+" : String(v);
  return LEVEL[Number(v) - 1];
}

/** +1 when the answer moved the way that tends to keep people, -1 the other way, 0 unchanged. */
function direction(key: Key, from: Answers[Key], to: Answers[Key]): number {
  if (from === to) return 0;
  if (key === "overTime") return to === "No" ? 1 : -1;
  if (key === "businessTravel") {
    const d = TRAVEL_ORDER.indexOf(to as Answers["businessTravel"]) - TRAVEL_ORDER.indexOf(from as Answers["businessTravel"]);
    return d < 0 ? 1 : -1;
  }
  return Number(to) > Number(from) ? 1 : -1;
}

/** Quarters across, questions down. A cell that moved since the quarter before is tinted and arrowed. */
export function CheckInAnswers({ checkIns }: { checkIns: Person["checkIns"] }) {
  const scroller = useRef<HTMLDivElement>(null);
  // On a narrow screen the grid scrolls sideways; start at the latest quarter, the one that matters most.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [checkIns.length]);
  if (checkIns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
        <p className="font-medium">No check-ins yet</p>
        <p className="mt-1 text-sm text-muted">Their answers will show here, quarter by quarter, after the first one.</p>
      </div>
    );
  }
  return (
    <div>
      <div ref={scroller} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:thin] md:mx-0 md:px-0">
        <table data-testid="checkin-grid" className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="sticky left-0 z-10 w-[7.5rem] bg-bg pb-3 pr-3 font-normal shadow-[-1rem_0_0_var(--bg)] after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-6 after:bg-linear-to-r after:from-bg after:to-transparent md:after:hidden md:w-[30%] md:shadow-none">Question</th>
              {checkIns.map((c, i) => {
                const latest = i === checkIns.length - 1;
                return (
                  <th
                    key={c.quarter}
                    scope="col"
                    className={`tabular rounded-t-xl pb-3 pl-2 pt-2.5 font-normal ${latest ? "bg-surface font-medium text-ink" : ""}`}
                  >
                    {c.quarter}
                    {latest && <span className="ml-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Latest</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, r) => (
              <tr key={row.key}>
                <th scope="row" className="sticky left-0 z-10 border-t border-line bg-bg py-2.5 pr-3 text-left font-normal leading-snug text-ink-soft shadow-[-1rem_0_0_var(--bg)] after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-6 after:bg-linear-to-r after:from-bg after:to-transparent md:after:hidden md:shadow-none">
                  {row.label}
                </th>
                {checkIns.map((c, i) => {
                  const v = c.answers[row.key];
                  const d = i ? direction(row.key, checkIns[i - 1].answers[row.key], v) : 0;
                  const tint = d < 0 ? "bg-signal-soft text-ink" : d > 0 ? "bg-calm/20 text-ink" : "";
                  const latest = i === checkIns.length - 1;
                  const lastRow = r === ROWS.length - 1;
                  return (
                    <td
                      key={c.quarter}
                      className={`border-t border-line py-1.5 pl-2 ${latest ? "bg-surface" : ""} ${latest && lastRow ? "rounded-b-xl" : ""}`}
                    >
                      <span
                        data-changed={d !== 0 || undefined}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${tint}`}
                      >
                        {show(row.key, v)}
                        {d < 0 && <ArrowDownIcon size={12} weight="bold" className="text-signal" role="img" aria-label="worse than the quarter before" />}
                        {d > 0 && <ArrowUpIcon size={12} weight="bold" className="text-calm" role="img" aria-label="better than the quarter before" />}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-signal-soft ring-1 ring-signal/60" /> Moved the wrong way since the quarter before
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-calm/20 ring-1 ring-calm/60" /> Moved the right way
        </span>
      </div>
    </div>
  );
}
