"use client";

import { ArrowLeftIcon, UserCircleDashedIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import { getPerson, getPublicSummary, type Person } from "@/lib/api";
import { int, pct, signedPct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { useApi } from "@/lib/useApi";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { PillButton } from "@/components/ui/PillButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { BandChip } from "../BandChip";
import { DriverBars } from "../DriverBars";
import { ActionPlans } from "./ActionPlans";
import { CheckInAnswers } from "./CheckInAnswers";
import { KeepMe } from "./KeepMe";
import { RiskHistory } from "./RiskHistory";
import { Section } from "./Section";
import { WhatIf } from "./WhatIf";

const SHELL = "mx-auto max-w-[1400px] px-4 pb-24 pt-10 md:px-8 md:pt-14";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** The score as a bar with the flag line marked, so the number has a scale next to it. */
function ScoreMeter({ value, threshold }: { value: number; threshold: number | null }) {
  const reduce = useReducedMotion();
  const flagged = threshold !== null && value >= threshold;
  return (
    <div className="relative mb-6 mt-6 h-1.5 rounded-full bg-haze/60" aria-hidden>
      <motion.div
        className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${flagged ? "bg-signal" : "bg-calm"}`}
        initial={{ transform: reduce ? `scaleX(${value})` : "scaleX(0)" }}
        animate={{ transform: `scaleX(${value})` }}
        transition={{ duration: 0.9, delay: reduce ? 0 : 0.15, ease: EASE_OUT }}
      />
      {threshold !== null && (
        <span className="absolute -top-1.5 h-[18px] w-px bg-ink/70" style={{ left: `${threshold * 100}%` }}>
          <span className="absolute left-1/2 top-[22px] -translate-x-1/2 whitespace-nowrap text-[11px] text-muted">
            Flag {pct(threshold)}
          </span>
        </span>
      )}
    </div>
  );
}

function Header({ person, threshold }: { person: Person; threshold: number | null }) {
  const facts = [
    person.department,
    `Level ${person.jobLevel}`,
    `${person.yearsAtCompany} ${person.yearsAtCompany === 1 ? "year" : "years"} here`,
    `$${int(person.monthlyIncome)}/mo`,
  ];
  const h = person.riskHistory;
  const prev = h.length > 1 ? h[h.length - 2] : null;
  const delta = prev ? person.riskScore - prev.riskScore : null;
  return (
    <header className="grid grid-cols-12 items-end gap-y-10 lg:gap-x-12">
      <div className="col-span-12 min-w-0 lg:col-span-7">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold tracking-wide text-bg ring-4 ring-surface"
          >
            {initials(person.name)}
          </span>
          <p className="min-w-0 text-sm text-muted">
            <span className="font-medium text-ink-soft">{person.jobRole}</span>
          </p>
        </div>
        <h1 className="mt-6 text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-balance">{person.name}</h1>
        <ul className="mt-6 flex flex-wrap gap-2">
          {facts.map((f) => (
            <li key={f} className="tabular rounded-full border border-line bg-surface/60 px-3 py-1 text-sm text-ink-soft">
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="col-span-12 lg:col-span-5">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[0_1px_0_rgb(14_17_22/0.04),0_24px_48px_-32px_rgb(27_36_48/0.45)] md:p-7">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted">Risk score</p>
            <BandChip band={person.riskBand} />
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <AnimatedNumber
              testId="person-score"
              value={person.riskScore}
              format={(v) => pct(v)}
              className="block text-[clamp(3.75rem,8vw,6rem)] font-semibold leading-[0.85] tracking-[-0.05em]"
            />
            {delta !== null && prev && (
              <p className="pb-1 text-right text-sm leading-tight text-muted">
                <span className={`tabular block text-base font-semibold ${delta > 0.005 ? "text-signal" : delta < -0.005 ? "text-calm" : "text-ink"}`}>
                  {signedPct(delta)}
                </span>
                since {prev.quarter}
              </p>
            )}
          </div>
          <ScoreMeter value={person.riskScore} threshold={threshold} />
        </div>
      </div>
    </header>
  );
}

function Loaded({ person, threshold, refresh }: { person: Person; threshold: number | null; refresh: () => Promise<void> }) {
  const h = person.riskHistory;
  // Good news reads in the calm colour; orange stays reserved for risk going up.
  const fell = h.length > 1 && h[h.length - 1].riskScore < h[h.length - 2].riskScore;
  return (
    <div className={SHELL}>
      <Link
        href="/hr"
        className="group -ml-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.97] [@media(hover:hover)]:hover:bg-surface [@media(hover:hover)]:hover:text-ink"
      >
        <ArrowLeftIcon size={14} aria-hidden className="transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:-translate-x-0.5" /> Dashboard
      </Link>
      <div className="mt-8">
        <Header person={person} threshold={threshold} />
      </div>

      {person.change && (
        <Reveal y={12} className="mt-12 md:mt-16">
          <div className={`relative max-w-[52rem] border-l-2 pl-5 md:pl-7 ${fell ? "border-calm" : "border-signal"}`}>
            <p className={`text-xs font-medium uppercase tracking-[0.14em] ${fell ? "text-calm" : "text-signal"}`}>What changed</p>
            <p
              data-testid="change"
              className="mt-3 max-w-[40ch] text-[clamp(1.25rem,2.4vw,2rem)] font-medium leading-snug tracking-[-0.02em] text-ink-soft text-pretty"
            >
              {person.change}
            </p>
          </div>
        </Reveal>
      )}

      <div className="mt-16 grid grid-cols-12 gap-y-16 md:mt-24 lg:gap-x-16">
        <Section n={1} id="drivers" title="What's driving it" className="col-span-12 lg:col-span-6">
          <DriverBars drivers={person.drivers} />
        </Section>

        <Section
          n={2}
          id="history"
          title="Risk over quarters"
          aside={threshold !== null ? <>Flagged at {pct(threshold)} or above</> : null}
          className="col-span-12 lg:col-span-6"
        >
          {person.riskHistory.length ? <RiskHistory history={person.riskHistory} threshold={threshold} /> : <p className="text-muted">No check-ins yet.</p>}
        </Section>

        <Section n={3} id="answers" title="Check-in answers" aside="Their own words, quarter by quarter" className="col-span-12">
          <CheckInAnswers checkIns={person.checkIns} />
        </Section>

        <Section n={4} id="keep" title="What would keep them here" className="col-span-12 lg:col-span-5">
          <KeepMe checkIns={person.checkIns} />
        </Section>

        <Section n={5} id="plans" title="Action plans" aside="Estimated by the model, then measured" className="col-span-12 lg:col-span-7">
          <ActionPlans personId={person.id} score={person.riskScore} levers={person.levers} plans={person.plans} onChanged={refresh} />
        </Section>

        <Section n={6} id="what-if" title="What-if" aside="Nothing here is saved" className="col-span-12">
          {/* A new recorded score (a plan marked done) starts the what-if over from it. */}
          <WhatIf key={`${person.riskScore}`} person={person} threshold={threshold} />
        </Section>
      </div>

      <Disclaimer className="mt-16" />
    </div>
  );
}

export function PersonView() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data, error, retry } = useApi(() => getPerson(id), [id]);
  // The flag line is a model-wide number; it arrives on its own and the charts draw it when it lands.
  const summary = useApi(getPublicSummary, []);
  const [fresh, setFresh] = useState<{ id: number; person: Person } | null>(null);

  const refresh = useCallback(async () => {
    const person = await getPerson(id);
    setFresh({ id, person });
  }, [id]);

  if (error?.status === 404 || Number.isNaN(id)) {
    return (
      <div className={SHELL}>
        <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-line bg-surface p-8 text-center md:p-12">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-bg text-muted">
            <UserCircleDashedIcon size={28} aria-hidden />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-balance">No one here with ID {params.id}.</h1>
          <p className="mt-3 text-muted">They may have left, or the link is out of date.</p>
          <div className="mt-8 flex justify-center">
            <PillButton href="/hr" variant="dark">Back to the dashboard</PillButton>
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className={SHELL}>
        <ErrorState message={error.message} status={error.status} onRetry={retry} />
      </div>
    );
  }
  if (!data) return <PersonSkeleton />;
  const person = fresh?.id === id ? fresh.person : data;
  return <Loaded person={person} threshold={summary.data?.metrics.after.threshold ?? null} refresh={refresh} />;
}

export function PersonSkeleton() {
  return (
    <div className={SHELL} aria-busy>
      <Skeleton className="h-4 w-24" />
      <div className="mt-8 grid grid-cols-12 items-end gap-y-10 lg:gap-x-12">
        <div className="col-span-12 lg:col-span-7">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="mt-6 h-16 w-[min(28rem,100%)]" />
          <div className="mt-6 flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="col-span-12 h-[188px] rounded-3xl lg:col-span-5" />
      </div>
      <Skeleton className="mt-16 h-20 w-[min(40rem,100%)]" />
      <div className="mt-24 grid grid-cols-12 gap-y-16 lg:gap-x-16">
        <div className="col-span-12 flex flex-col gap-4 lg:col-span-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
        <Skeleton className="col-span-12 h-[260px] lg:col-span-6" />
        <Skeleton className="col-span-12 h-[360px]" />
      </div>
    </div>
  );
}
