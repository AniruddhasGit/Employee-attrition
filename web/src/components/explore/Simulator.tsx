"use client";

import { ArrowCounterClockwiseIcon, CheckIcon, LinkSimpleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getEmployee, getMetrics, saveScenario, simulate, type Levers, type SimulateResult } from "@/lib/api";
import { int, pct, signedPct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { BandChip } from "./BandChip";
import { DriverBars } from "./DriverBars";
import { LeverPanel } from "./LeverPanel";
import { RiskGauge } from "./RiskGauge";

async function load(id: number) {
  const [detail, metrics] = await Promise.all([getEmployee(id), getMetrics()]);
  return { detail, threshold: metrics.threshold };
}

type Loaded = Awaited<ReturnType<typeof load>>;

function Workbench({ detail, threshold }: Loaded) {
  const [levers, setLevers] = useState<Levers>({});
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const changed = Object.keys(levers).length > 0;
  useEffect(() => {
    if (!changed) return;
    const id = ++request.current;
    const timer = setTimeout(() => {
      simulate(detail.id, levers)
        .then((r) => {
          if (id !== request.current) return;
          setResult(r);
          setFailed(false);
        })
        .catch(() => id === request.current && setFailed(true));
    }, 200);
    return () => clearTimeout(timer);
  }, [levers, changed, detail.id]);

  const current = { ...detail.levers, ...levers };
  const after = changed && result ? result.after : detail.riskScore;
  const band = changed && result ? result.afterBand : detail.riskBand;
  const drivers = changed && result ? result.drivers : detail.drivers;
  const delta = after - detail.riskScore;

  function update(patch: Levers) {
    setShare(null);
    setLevers((l) => {
      const next = { ...l, ...patch };
      // Drop levers that are back at their recorded value.
      for (const k of Object.keys(next) as (keyof Levers)[]) {
        if (next[k] === detail.levers[k]) delete next[k];
      }
      return next;
    });
  }

  async function onShare() {
    try {
      const { publicId } = await saveScenario(detail.id, levers);
      const url = `/s/${publicId}`;
      setShare(url);
      await navigator.clipboard?.writeText(`${location.origin}${url}`).catch(() => undefined);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-32 md:px-8">
      <Link href="/explore" className="text-sm text-muted hover:text-ink">
        ← All people
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[1] tracking-[-0.04em]">{detail.jobRole}</h1>
          <p className="mt-2 text-muted">
            {detail.department} · Level {detail.jobLevel} · {detail.yearsAtCompany} years here · $
            {int(detail.monthlyIncome)}/mo · Employee {detail.id}
          </p>
        </div>
        <BandChip band={band} />
      </div>

      <div className="mt-12 grid grid-cols-12 gap-y-12 md:gap-x-12">
        <div className="col-span-12 lg:col-span-7">
          <div className="rounded-2xl border border-line bg-surface p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-sm text-muted">
                  {failed ? "Out of date: couldn't update" : changed ? "With your changes" : "Risk score"}
                </p>
                <AnimatedNumber
                  testId="sim-after"
                  value={after}
                  format={(v) => pct(v)}
                  className={`text-[clamp(4rem,9vw,7rem)] font-semibold leading-none tracking-[-0.045em] transition-opacity duration-200 ${failed ? "opacity-35" : ""}`}
                />
                <p className="mt-2 text-sm text-muted">
                  Recorded score <span data-testid="sim-before" className="tabular text-ink">{pct(detail.riskScore)}</span>
                  {changed && (
                    <span className={`ml-3 tabular font-medium ${delta < 0 ? "text-calm" : "text-signal"}`}>
                      {signedPct(delta)}
                    </span>
                  )}
                </p>
              </div>
              <RiskGauge value={after} before={detail.riskScore} threshold={threshold} />
            </div>
            <div className="mt-10 border-t border-line pt-6">
              <h2 className="mb-4 font-medium">What drives this score</h2>
              <DriverBars drivers={drivers} />
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            This shows how the model responds to a change, not what causes anyone to leave. Treat
            it as a question worth asking, not an answer.
          </p>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="lg:sticky lg:top-8">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">What could an employer change?</h2>
              <button
                type="button"
                onClick={() => (setLevers({}), setResult(null), setShare(null))}
                disabled={!changed}
                className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink disabled:opacity-40"
              >
                <ArrowCounterClockwiseIcon size={14} /> Reset
              </button>
            </div>
            <div className="mt-6">
              <LeverPanel value={current} onChange={update} />
            </div>
            {failed && <p className="mt-4 text-sm text-signal">Couldn&apos;t reach the model. Try again.</p>}
            <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-6">
              <button
                type="button"
                onClick={onShare}
                disabled={!changed}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-40"
              >
                <LinkSimpleIcon size={14} /> Save &amp; share
              </button>
              {share && (
                <a data-testid="share-link" href={share} className="inline-flex items-center gap-1.5 text-sm text-calm">
                  <CheckIcon size={14} /> Link copied: {share}
                </a>
              )}
            </div>
            <Disclaimer className="mt-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Simulator() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data, error, retry } = useApi(() => load(id), [id]);

  if (error?.status === 404 || Number.isNaN(id)) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-32 md:px-8">
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">No employee {params.id} here.</h1>
        <p className="mt-4 text-muted">IDs run from 1001 to 2470.</p>
        <Link href="/explore" className="mt-6 inline-block underline">Back to everyone</Link>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-32 md:px-8">
        <ErrorState message={error.message} status={error.status} onRetry={retry} />
      </div>
    );
  }
  if (!data) return <SimulatorSkeleton />;
  return <Workbench key={id} {...data} />;
}

export function SimulatorSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-32 md:px-8">
      <Skeleton className="h-12 w-72" />
      <div className="mt-12 grid grid-cols-12 gap-12">
        <Skeleton className="col-span-12 h-[480px] lg:col-span-7" />
        <Skeleton className="col-span-12 h-[480px] lg:col-span-5" />
      </div>
    </div>
  );
}
