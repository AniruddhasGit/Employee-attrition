"use client";

import { UserPlusIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { getDashboard, type Dashboard as Data } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { useApi } from "@/lib/useApi";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CostAtStake } from "./dashboard/CostAtStake";
import { KeepThemes } from "./dashboard/KeepThemes";
import { KpiStrip } from "./dashboard/KpiStrip";
import { PeopleTable } from "./dashboard/PeopleTable";
import { Section } from "./dashboard/Section";
import { SharpDrops } from "./dashboard/SharpDrops";
import { TrustPanel } from "./dashboard/TrustPanel";
import { Heatmap } from "./Heatmap";

const shell = "mx-auto max-w-[1400px] px-4 pb-24 pt-8 md:px-8 md:pt-14";

/** HR's one page: the numbers, who changed, who is at risk, where, what would help, and how far to trust it. */
export function Dashboard() {
  const { data, error, retry } = useApi(() => getDashboard());

  if (error) {
    return (
      <div className={shell}>
        <ErrorState message={error.message} status={error.status} onRetry={retry} />
      </div>
    );
  }
  return <div className={shell}>{data ? <Loaded d={data} /> : <Loading />}</div>;
}

function Header({ d }: { d?: Data }) {
  const reduce = useReducedMotion();
  const rise = (i: number) => ({
    initial: { opacity: 0, transform: `translateY(${reduce ? 0 : 10}px)` },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: 0.5, delay: i * 0.06, ease: EASE_OUT },
  });

  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
      <div className="min-w-0">
        <motion.p {...rise(0)} className="flex items-center gap-2 text-sm text-muted">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inset-0 rounded-full bg-calm opacity-60 motion-safe:animate-ping" />
            <span className="relative size-2 rounded-full bg-calm" />
          </span>
          People overview{d ? ` · ${d.quarter} check-in` : ""}
        </motion.p>
        <motion.h1
          {...rise(1)}
          className="mt-4 text-balance text-[clamp(2.4rem,6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
        >
          Your people, this quarter.
        </motion.h1>
        {d && (
          <motion.p {...rise(2)} className="mt-5 max-w-[58ch] text-pretty text-base leading-relaxed text-muted md:text-lg">
            <span className="font-medium text-ink">{int(d.highRisk)} people</span> sit in the high band, {pct(d.highRisk / d.headcount, 1)} of{" "}
            {int(d.headcount)}. <span className="font-medium text-ink">{int(d.sharpDrops.length)}</span> changed sharply since{" "}
            {d.previousQuarter}, and {pct(d.responseRate)} answered the check-in.
          </motion.p>
        )}
      </div>
      {d && (
        <motion.p {...rise(3)} className="tabular flex shrink-0 items-center gap-2 text-sm text-muted">
          <span className="rounded-full bg-ink px-3 py-1 font-medium text-bg">{d.quarter}</span>
          compared with {d.previousQuarter}
        </motion.p>
      )}
    </header>
  );
}

const JUMPS = [
  { id: "sharp-drops", label: "Sharp drops" },
  { id: "people", label: "People" },
  { id: "concentration", label: "Concentration" },
  { id: "keep", label: "What would keep people" },
  { id: "trust", label: "Trust" },
];

/** In-page shortcuts to each section; scrolls sideways on a phone instead of wrapping. */
function JumpNav({ drops }: { drops: number }) {
  return (
    <nav aria-label="Dashboard sections" className="-mx-4 mt-8 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:mt-10 md:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max gap-1.5">
        {JUMPS.map((j) => (
          <li key={j.id}>
            <a
              href={`#${j.id}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink-soft transition-[background-color,border-color,transform] duration-150 ease-out hover:border-ink/25 hover:bg-surface active:scale-[0.97]"
            >
              {j.label}
              {j.id === "sharp-drops" && drops > 0 && (
                <span className="tabular rounded-full bg-signal-soft px-1.5 text-xs font-medium text-signal">{int(drops)}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Loaded({ d }: { d: Data }) {
  // Cost scales linearly with the replacement %, so the slider never waits on the network.
  const [replacement, setReplacement] = useState(d.replacementPct);
  const scale = replacement / d.replacementPct;
  const departments = [...new Set(d.heatmap.map((c) => c.department))].sort();
  const cells = d.heatmap.map((c) => ({ ...c, expectedCost: c.expectedCost * scale }));

  return (
    <>
      <Header d={d} />
      <JumpNav drops={d.sharpDrops.length} />

      <div className="mt-6 grid grid-cols-12 gap-3 md:mt-8">
        <div className="col-span-12 lg:col-span-5">
          <CostAtStake cost={d.costAtStake * scale} highRisk={d.highRisk} replacement={replacement} onReplacement={setReplacement} />
        </div>
        <div className="col-span-12 lg:col-span-7">
          <KpiStrip d={d} />
        </div>
      </div>

      <div className="mt-16 md:mt-24">
        <Section
          id="sharp-drops"
          n="01"
          kicker="Early warning"
          title="Sharp drops since last check-in"
          intro={`${int(d.sharpDrops.length)} people whose answers fell by two points or more, or whose score rose 10 points or more, since ${d.previousQuarter}. Talk to them before they decide.`}
        >
          <SharpDrops drops={d.sharpDrops} previousQuarter={d.previousQuarter} />
        </Section>

        <Section
          id="people"
          n="02"
          kicker="Everyone"
          title="People at risk"
          intro="Everyone, riskiest first. Open a person to see why, and what might help."
          aside={
            <Link
              href="/hr/people/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              <UserPlusIcon size={16} aria-hidden />
              Add person
            </Link>
          }
        >
          <PeopleTable departments={departments} />
        </Section>

        <Section
          id="concentration"
          n="03"
          kicker="Concentration"
          title="Where risk concentrates"
          intro="Average risk score for each role, by department. Wider tiles hold more people. Point at or tap a tile for headcount and expected cost at the replacement rate above."
        >
          <Heatmap cells={cells} />
        </Section>

        <Section
          id="keep"
          n="04"
          kicker="Retention levers"
          title="What would keep people here"
          intro={`What people picked in the ${d.quarter} check-in, by department. Teams with fewer than five answers stay hidden.`}
        >
          <KeepThemes themes={d.keepThemes} />
        </Section>

        <Section
          id="trust"
          n="05"
          kicker="Model quality"
          title="Can you trust these scores?"
          intro="A model is a guide, not a verdict. These figures come from people it never saw while learning."
        >
          <TrustPanel trust={d.trust} />
        </Section>
      </div>
    </>
  );
}

/** Skeletons in the shape of the page so nothing jumps when data lands. */
function Loading() {
  return (
    <div aria-busy aria-label="Loading the dashboard">
      <Header />
      <Skeleton className="mt-5 h-6 w-[min(36rem,100%)] rounded-full" />
      <div className="mt-8 flex gap-1.5 md:mt-10">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-12 gap-3 md:mt-8">
        <Skeleton className="col-span-12 h-80 lg:col-span-5 lg:h-auto" />
        <div className="col-span-12 grid grid-cols-2 gap-3 lg:col-span-7">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 md:h-40" />
          ))}
        </div>
      </div>
      <div className="mt-16 border-t border-line pt-14 md:mt-24">
        <Skeleton className="h-3 w-32 rounded-full" />
        <Skeleton className="mt-4 h-10 w-80 max-w-full" />
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    </div>
  );
}
