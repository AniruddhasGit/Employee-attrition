"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { simulate, type Levers, type Person, type SimulateResult } from "@/lib/api";
import { pct, signedPct } from "@/lib/format";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { BandChip } from "../BandChip";
import { DriverBars } from "../DriverBars";
import { LeverPanel } from "../LeverPanel";
import { RiskGauge } from "../RiskGauge";

/** Move the levers, see the score and its drivers respond. Nothing here is saved. */
export function WhatIf({ person, threshold }: { person: Person; threshold: number | null }) {
  const [levers, setLevers] = useState<Levers>({});
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const changed = Object.keys(levers).length > 0;
  useEffect(() => {
    if (!changed) return;
    const id = ++request.current;
    const timer = setTimeout(() => {
      simulate(person.id, levers)
        .then((r) => {
          if (id !== request.current) return;
          setResult(r);
          setFailed(false);
        })
        .catch(() => id === request.current && setFailed(true));
    }, 200);
    return () => clearTimeout(timer);
  }, [levers, changed, person.id]);

  const live = changed && result;
  const after = live ? result.after : person.riskScore;
  const band = live ? result.afterBand : person.riskBand;
  const drivers = live ? result.drivers : person.drivers;
  const delta = after - person.riskScore;

  function update(patch: Levers) {
    setLevers((l) => {
      const next = { ...l, ...patch };
      // Drop levers that are back at their recorded value.
      for (const k of Object.keys(next) as (keyof Levers)[]) {
        if (next[k] === person.levers[k]) delete next[k];
      }
      return next;
    });
  }

  function reset() {
    request.current++;
    setLevers({});
    setResult(null);
    setFailed(false);
  }

  return (
    <div className="grid grid-cols-12 gap-y-10 lg:gap-x-12">
      <div className="col-span-12 min-w-0 lg:col-span-7">
        <div className="rounded-2xl border border-line bg-surface p-5 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-sm text-muted">
                {failed ? "Out of date: couldn't update" : changed ? "Model's estimate with these changes" : "Risk score now"}
                <BandChip band={band} />
              </p>
              <AnimatedNumber
                testId="sim-after"
                value={after}
                format={(v) => pct(v)}
                className={`mt-1 block text-[clamp(3.5rem,8vw,6rem)] font-semibold leading-none tracking-[-0.045em] transition-opacity duration-200 ${failed ? "opacity-35" : ""}`}
              />
              <p className="mt-2 text-sm text-muted">
                Recorded <span className="tabular text-ink">{pct(person.riskScore)}</span>
                {changed && (
                  <span className={`ml-3 tabular font-medium ${delta < 0 ? "text-calm" : "text-signal"}`}>{signedPct(delta)}</span>
                )}
              </p>
            </div>
            <RiskGauge value={after} before={person.riskScore} threshold={threshold} />
          </div>
          <div className="mt-10 border-t border-line pt-6">
            <h3 className="mb-4 font-medium">What drives this score</h3>
            <DriverBars drivers={drivers} />
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          This shows how the model responds to a change, not what causes anyone to leave. Treat it as a question worth asking, not an answer.
        </p>
      </div>

      <div className="col-span-12 min-w-0 lg:col-span-5">
        <div className="lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Levers</h3>
            <button
              type="button"
              onClick={reset}
              disabled={!changed}
              className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-ink disabled:opacity-40"
            >
              <ArrowCounterClockwiseIcon size={14} aria-hidden /> Reset
            </button>
          </div>
          <div className="mt-6">
            <LeverPanel value={{ ...person.levers, ...levers }} onChange={update} />
          </div>
          {failed && <p className="mt-4 text-sm text-signal">Couldn&apos;t reach the model. Move a lever again in a moment.</p>}
        </div>
      </div>
    </div>
  );
}
