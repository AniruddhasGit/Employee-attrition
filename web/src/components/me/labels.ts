import type { Answers } from "@/lib/api";

/** "2026-Q4" -> "Q4 2026". */
export function fmtQuarter(q: string): string {
  const [year, part] = q.split("-");
  return part ? `${part} ${year}` : q;
}

const LEVEL = ["Low", "Medium", "High", "Very high"];
const BALANCE = ["Bad", "Good", "Better", "Best"];
const TRAVEL: Record<string, string> = { "Non-Travel": "Not at all", Travel_Rarely: "Now and then", Travel_Frequently: "Often" };

/** Short row labels and value wording for past answers (the form's own labels come from the API). */
export const ANSWER_ROWS: { key: keyof Answers; label: string; show: (v: Answers[keyof Answers]) => string }[] = [
  { key: "environmentSatisfaction", label: "Work environment", show: (v) => LEVEL[Number(v) - 1] ?? String(v) },
  { key: "jobSatisfaction", label: "The job itself", show: (v) => LEVEL[Number(v) - 1] ?? String(v) },
  { key: "relationshipSatisfaction", label: "Working relationships", show: (v) => LEVEL[Number(v) - 1] ?? String(v) },
  { key: "workLifeBalance", label: "Work-life balance", show: (v) => BALANCE[Number(v) - 1] ?? String(v) },
  { key: "jobInvolvement", label: "Involvement in your work", show: (v) => LEVEL[Number(v) - 1] ?? String(v) },
  { key: "overTime", label: "Regular overtime", show: (v) => String(v) },
  { key: "businessTravel", label: "Work travel", show: (v) => TRAVEL[String(v)] ?? String(v) },
  { key: "trainingTimesLastYear", label: "Training sessions, last 12 months", show: (v) => (Number(v) >= 6 ? "6 or more" : String(v)) },
];
