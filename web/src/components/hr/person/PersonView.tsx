"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { getPerson, getPublicSummary, type Person } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Disclaimer } from "@/components/ui/Disclaimer";
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

function Header({ person }: { person: Person }) {
  const facts = [
    person.jobRole,
    person.department,
    `Level ${person.jobLevel}`,
    `${person.yearsAtCompany} ${person.yearsAtCompany === 1 ? "year" : "years"} here`,
    `$${int(person.monthlyIncome)}/mo`,
  ];
  return (
    <header className="grid grid-cols-12 items-end gap-y-8">
      <div className="col-span-12 min-w-0 md:col-span-8">
        <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-[0.95] tracking-[-0.045em]">{person.name}</h1>
        <p className="mt-4 flex flex-wrap gap-x-2 text-muted">
          {facts.map((f, i) => (
            <span key={f}>
              {f}
              {i < facts.length - 1 && <span aria-hidden className="ml-2 text-mist">·</span>}
            </span>
          ))}
        </p>
      </div>
      <div className="col-span-12 flex items-end justify-between gap-4 md:col-span-4 md:flex-col md:items-end">
        <div className="md:text-right">
          <p className="flex items-center gap-2 text-sm text-muted md:justify-end">
            Risk score <BandChip band={person.riskBand} />
          </p>
          <AnimatedNumber
            testId="person-score"
            value={person.riskScore}
            format={(v) => pct(v)}
            className="mt-1 block text-[clamp(3.5rem,7vw,6rem)] font-semibold leading-none tracking-[-0.05em]"
          />
        </div>
      </div>
    </header>
  );
}

function Loaded({ person, threshold, refresh }: { person: Person; threshold: number | null; refresh: () => Promise<void> }) {
  return (
    <div className={SHELL}>
      <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-ink">
        <ArrowLeftIcon size={14} aria-hidden /> Dashboard
      </Link>
      <div className="mt-8">
        <Header person={person} />
      </div>

      {person.change && (
        <Reveal y={12} className="mt-12 md:mt-16">
          <p
            data-testid="change"
            className="max-w-[40ch] border-l-2 border-signal pl-5 text-[clamp(1.25rem,2.4vw,2rem)] font-medium leading-snug tracking-[-0.02em] text-ink-soft"
          >
            {person.change}
          </p>
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

        <Section n={4} id="keep" title="What would keep them here" className="col-span-12 lg:col-span-4">
          <KeepMe checkIns={person.checkIns} />
        </Section>

        <Section n={5} id="plans" title="Action plans" className="col-span-12 lg:col-span-8">
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
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">No one here with ID {params.id}.</h1>
        <p className="mt-4 text-muted">They may have left, or the link is out of date.</p>
        <Link href="/hr" className="mt-6 inline-block underline">Back to the dashboard</Link>
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
      <div className="mt-8 grid grid-cols-12 items-end gap-y-8">
        <div className="col-span-12 md:col-span-8">
          <Skeleton className="h-16 w-[min(28rem,100%)]" />
          <Skeleton className="mt-4 h-5 w-[min(36rem,100%)]" />
        </div>
        <div className="col-span-12 flex md:col-span-4 md:justify-end">
          <Skeleton className="h-20 w-40" />
        </div>
      </div>
      <Skeleton className="mt-16 h-16 w-[min(40rem,100%)]" />
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
