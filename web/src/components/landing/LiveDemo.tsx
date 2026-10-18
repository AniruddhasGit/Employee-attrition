"use client";

import { useEffect, useRef, useState } from "react";
import { getEmployee, getMetrics, randomEmployee, simulate, type EmployeeDetail, type Levers } from "@/lib/api";
import { bandLabel, int, pct, signedPct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { ErrorState } from "@/components/ui/ErrorState";
import { PillButton } from "@/components/ui/PillButton";
import { Reveal } from "@/components/ui/Reveal";
import { RiskMeter } from "@/components/ui/RiskMeter";
import { Skeleton } from "@/components/ui/Skeleton";

async function loadDemo() {
  const [card, metrics] = await Promise.all([randomEmployee("high"), getMetrics()]);
  const detail = await getEmployee(card.id);
  return { detail, threshold: metrics.threshold };
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-out ${checked ? "bg-ink" : "bg-haze"}`}
    >
      <span
        className={`absolute left-1 top-1 size-5 rounded-full bg-surface transition-transform duration-200 ease-out ${checked ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

function Demo({ detail, threshold }: { detail: EmployeeDetail; threshold: number }) {
  const [levers, setLevers] = useState<Levers>({});
  const [score, setScore] = useState(detail.riskScore);
  const [band, setBand] = useState(detail.riskBand);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    if (!Object.keys(levers).length) return;
    const id = ++request.current;
    const timer = setTimeout(() => {
      simulate(detail.id, levers)
        .then((r) => {
          if (id !== request.current) return;
          setScore(r.after);
          setBand(r.afterBand);
          setFailed(false);
        })
        .catch(() => id === request.current && setFailed(true));
    }, 180);
    return () => clearTimeout(timer);
  }, [levers, detail.id]);

  const overTime = levers.overTime ?? detail.levers.overTime;
  const income = levers.monthlyIncome ?? detail.levers.monthlyIncome;
  const delta = score - detail.riskScore;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {detail.jobRole}, {detail.department}
        </p>
        <p className="text-sm text-muted">
          Level {detail.jobLevel} · {detail.yearsAtCompany} yrs here
        </p>
      </div>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{failed ? "Out of date: couldn't update" : "Risk score"}</p>
          <AnimatedNumber
            testId="demo-risk"
            value={score}
            format={(v) => pct(v)}
            className={`text-[clamp(3.5rem,8vw,6rem)] font-semibold leading-none tracking-[-0.04em] transition-opacity duration-200 ${failed ? "opacity-35" : ""}`}
          />
        </div>
        <div className="pb-2 text-right">
          <p className={`text-sm font-medium ${band === "high" ? "text-signal" : "text-calm"}`}>{bandLabel(band)}</p>
          <p className="tabular text-sm text-muted">{delta === 0 ? "as recorded" : signedPct(delta)}</p>
        </div>
      </div>

      <div className="mt-6">
        <RiskMeter value={score} threshold={threshold} />
      </div>

      <div className="mt-8 grid gap-6 border-t border-line pt-6">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-medium">Overtime</span>
            <span className="text-sm text-muted">{overTime === "Yes" ? "Works overtime" : "No overtime"}</span>
          </span>
          <Switch
            label="Overtime"
            checked={overTime === "Yes"}
            onChange={(on) => setLevers((l) => ({ ...l, overTime: on ? "Yes" : "No" }))}
          />
        </label>
        <div>
          <label htmlFor="demo-income" className="flex justify-between gap-4">
            <span className="font-medium">Monthly income</span>
            <span className="tabular text-sm text-muted">${int(income)}</span>
          </label>
          <input
            id="demo-income"
            type="range"
            min={1000}
            max={20000}
            step={100}
            value={income}
            onChange={(e) => setLevers((l) => ({ ...l, monthlyIncome: Number(e.target.value) }))}
            className="mt-3 w-full accent-[var(--ink)]"
          />
        </div>
      </div>

      {failed && <p className="mt-4 text-sm text-signal">Couldn&apos;t update the score. Try again.</p>}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Disclaimer />
        <PillButton href={`/explore/${detail.id}`} variant="dark">
          All seven levers
        </PillButton>
      </div>
    </div>
  );
}

export function LiveDemo() {
  const { data, error, retry } = useApi(loadDemo);

  return (
    <section data-testid="live-demo" aria-labelledby="demo-title" className="mx-auto max-w-[1400px] px-4 py-24 md:px-8 md:py-32">
      <div className="grid grid-cols-12 gap-y-10 md:gap-x-10">
        <div className="col-span-12 md:col-span-5">
          <Reveal>
            <h2 id="demo-title" className="text-[clamp(2.25rem,4.4vw,4rem)] font-semibold leading-[1] tracking-[-0.035em]">
              Change one thing.
              <br />
              <span className="text-mist">Watch the score move.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-[42ch] leading-relaxed text-muted">
              A real employee from the dataset, scored by a model that never saw them. The model
              reacts to what you change. That shows what it has learned, not what causes anyone to
              leave.
            </p>
          </Reveal>
        </div>
        <div className="col-span-12 md:col-span-7">
          {data && <Demo detail={data.detail} threshold={data.threshold} />}
          {error && <ErrorState message={error.message} status={error.status} onRetry={retry} />}
          {!data && !error && <Skeleton className="h-[520px]" />}
        </div>
      </div>
    </section>
  );
}
