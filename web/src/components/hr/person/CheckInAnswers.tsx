import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react/dist/ssr";
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
  if (checkIns.length === 0) {
    return <p className="text-muted">No check-ins yet.</p>;
  }
  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table data-testid="checkin-grid" className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="w-[30%] pb-3 font-normal">Question</th>
              {checkIns.map((c) => (
                <th key={c.quarter} scope="col" className="tabular pb-3 pl-2 font-normal">{c.quarter}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="border-t border-line py-2.5 pr-3 text-left font-normal text-ink-soft">{row.label}</th>
                {checkIns.map((c, i) => {
                  const v = c.answers[row.key];
                  const d = i ? direction(row.key, checkIns[i - 1].answers[row.key], v) : 0;
                  const tint = d < 0 ? "bg-signal-soft text-ink" : d > 0 ? "bg-calm/15 text-ink" : "";
                  return (
                    <td key={c.quarter} className="border-t border-line py-1.5 pl-2">
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
          <span className="size-2.5 rounded-full bg-signal-soft ring-1 ring-signal/40" /> Moved the wrong way since the quarter before
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-calm/15 ring-1 ring-calm/40" /> Moved the right way
        </span>
      </div>
    </div>
  );
}
