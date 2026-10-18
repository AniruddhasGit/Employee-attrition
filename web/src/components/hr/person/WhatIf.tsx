"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { simulate, type Levers, type Person, type SimulateResult } from "@/lib/api";
import { pct, signedPct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
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
  const reduce = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);
  const cardInView = useInView(card, { amount: 0.2 });

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
    <div className="grid grid-cols-12 gap-y-6 lg:gap-x-12">
      <div ref={card} className="col-span-12 min-w-0 lg:col-span-7 lg:row-start-1">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[0_24px_48px_-36px_rgb(27_36_48/0.45)] md:p-8">
          <div className="flex items-center justify-between gap-4 sm:gap-6">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                {failed ? "Out of date: couldn't update" : changed ? "Model's estimate with these changes" : "Risk score now"}
                <BandChip band={band} />
              </p>
              <AnimatedNumber
                testId="sim-after"
                value={after}
                format={(v) => pct(v)}
                className={`mt-2 block text-[clamp(3.25rem,9vw,6.5rem)] font-semibold leading-[0.85] tracking-[-0.05em] transition-opacity duration-200 ${failed ? "opacity-35" : ""}`}
              />
              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span>
                  Recorded <span className="tabular font-medium text-ink">{pct(person.riskScore)}</span>
                </span>
                <AnimatePresence initial={false}>
                  {changed && (
                    <motion.span
                      key="delta"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.9)" }}
                      animate={{ opacity: 1, transform: "scale(1)" }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      className={`tabular rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        delta < -0.005 ? "bg-calm/15 text-calm" : delta > 0.005 ? "bg-signal-soft text-signal" : "bg-haze/50 text-muted"
                      }`}
                    >
                      {signedPct(delta)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </p>
            </div>
            <div className="w-1/2 max-w-[280px] shrink-0">
              <RiskGauge value={after} before={person.riskScore} threshold={threshold} />
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-12 min-w-0 lg:col-span-5 lg:row-span-2 lg:row-start-1">
        <div className="rounded-3xl border border-line bg-surface p-6 md:p-7 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Levers</h3>
              <p className="mt-0.5 text-sm text-muted">Move one and watch the score respond.</p>
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={!changed}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm text-ink-soft transition-[transform,opacity,background-color] duration-150 ease-out active:scale-[0.97] enabled:hover:bg-bg disabled:opacity-40"
            >
              <ArrowCounterClockwiseIcon size={14} aria-hidden /> Reset
            </button>
          </div>
          <div className="mt-6 border-t border-line pt-6">
            <LeverPanel value={{ ...person.levers, ...levers }} onChange={update} />
          </div>
          {failed && <p className="mt-4 text-sm text-signal">Couldn&apos;t reach the model. Move a lever again in a moment.</p>}
        </div>
      </div>

      <div className="col-span-12 min-w-0 lg:col-span-7 lg:row-start-2">
        <div className="rounded-3xl border border-line bg-surface p-6 md:p-8">
          <h3 className="mb-5 font-medium">What drives this score</h3>
          <DriverBars drivers={drivers} />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          This shows how the model responds to a change, not what causes anyone to leave. Treat it as a question worth asking, not an answer.
        </p>
      </div>

      {/* Phones: once the score card scrolls away, keep the live estimate in reach while the levers move. */}
      <AnimatePresence>
        {changed && !cardInView && (
          <motion.div
            key="float"
            role="status"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(16px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(16px)", transition: { duration: 0.15 } }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between gap-3 rounded-full bg-night py-2 pl-5 pr-2 text-night-ink shadow-[0_16px_40px_-12px_rgb(0_0_0/0.5)] lg:hidden"
          >
            <span className="text-sm">
              Estimate <span className="tabular ml-1 text-lg font-semibold">{pct(after)}</span>
              <span className={`tabular ml-2 text-xs font-medium ${delta < -0.005 ? "text-calm" : delta > 0.005 ? "text-signal" : "opacity-70"}`}>
                {signedPct(delta)}
              </span>
            </span>
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-night-ink/10 px-4 text-sm transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              <ArrowCounterClockwiseIcon size={14} aria-hidden /> Reset
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
