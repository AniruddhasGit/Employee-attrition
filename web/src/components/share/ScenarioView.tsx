"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getScenario, type Levers } from "@/lib/api";
import { int, pct, signedPct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { ErrorState } from "@/components/ui/ErrorState";
import { PillButton } from "@/components/ui/PillButton";
import { Skeleton } from "@/components/ui/Skeleton";

const LABELS: Record<keyof Levers, (v: never) => string> = {
  overTime: (v: "Yes" | "No") => (v === "Yes" ? "Works overtime" : "No overtime"),
  monthlyIncome: (v: number) => `Monthly income $${int(v)}`,
  stockOptionLevel: (v: number) => (v === 0 ? "No stock options" : `Stock option level ${v}`),
  jobLevel: (v: number) => `Job level ${v}`,
  trainingTimesLastYear: (v: number) => `${v} training sessions a year`,
  businessTravel: (v: string) => ({ "Non-Travel": "No business travel", Travel_Rarely: "Travels rarely", Travel_Frequently: "Travels frequently" })[v] ?? v,
  yearsSinceLastPromotion: (v: number) => `${v} years since last promotion`,
};

export function ScenarioView() {
  const { id } = useParams<{ id: string }>();
  const { data: s, error, retry } = useApi(() => getScenario(id), [id]);
  const wrap = "mx-auto max-w-[1100px] px-4 pb-24 pt-32 md:px-8";

  if (error?.status === 404) {
    return (
      <div className={wrap}>
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">This scenario isn&apos;t here.</h1>
        <p className="mt-4 text-muted">The link may be mistyped. You can build a new one in the explorer.</p>
        <div className="mt-8"><PillButton href="/explore" variant="dark">Open the explorer</PillButton></div>
      </div>
    );
  }
  if (error) return <div className={wrap}><ErrorState message={error.message} status={error.status} onRetry={retry} /></div>;
  if (!s) return <div className={wrap}><Skeleton className="h-96" /></div>;

  const changes = Object.entries(s.levers) as [keyof Levers, never][];
  return (
    <div className={wrap}>
      <p className="text-sm text-muted">A saved what-if scenario</p>
      <h1 className="mt-2 text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1] tracking-[-0.04em]">
        {s.employee.jobRole}, {s.employee.department}
      </h1>
      <div className="mt-12 grid grid-cols-1 gap-10 rounded-2xl border border-line bg-surface p-6 md:grid-cols-3 md:p-10">
        <div>
          <p className="text-sm text-muted">Recorded risk</p>
          <p className="tabular mt-1 text-6xl font-semibold tracking-[-0.04em] text-muted">{pct(s.before)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">With these changes</p>
          <AnimatedNumber testId="scenario-after" value={s.after} format={(v) => pct(v)} className="mt-1 block text-6xl font-semibold tracking-[-0.04em]" />
          <p className={`tabular mt-2 text-sm font-medium ${s.delta < 0 ? "text-calm" : "text-signal"}`}>{signedPct(s.delta)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">What changed</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {changes.length ? changes.map(([k, v]) => <li key={k}>{LABELS[k](v)}</li>) : <li className="text-muted">Nothing; this is the recorded profile.</li>}
          </ul>
        </div>
      </div>
      <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-muted">
        This shows how the model responds to the change, not what would make a real person stay.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <Disclaimer />
        <Link href={`/explore/${s.employee.id}`} className="text-sm underline underline-offset-4">Try your own changes</Link>
      </div>
    </div>
  );
}
