"use client";

import { useState } from "react";
import { getDashboard, type Dashboard as Data } from "@/lib/api";
import { int } from "@/lib/format";
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

const shell = "mx-auto max-w-[1400px] px-4 pb-24 pt-10 md:px-8 md:pt-14";

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

function Header({ quarter, previous }: { quarter?: string; previous?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <h1 className="text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.045em]">Your people, this quarter.</h1>
      {quarter && (
        <p className="tabular text-sm text-muted">
          <span className="rounded-full bg-ink px-2.5 py-1 text-bg">{quarter}</span>
          <span className="ml-2">compared with {previous}</span>
        </p>
      )}
    </header>
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
      <Header quarter={d.quarter} previous={d.previousQuarter} />

      <div className="mt-10 grid grid-cols-12 gap-3 md:mt-14">
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
          title="Sharp drops since last check-in"
          intro={`${int(d.sharpDrops.length)} people whose answers fell by two points or more, or whose score rose 10 points or more, since ${d.previousQuarter}. Talk to them before they decide.`}
        >
          <SharpDrops drops={d.sharpDrops} previousQuarter={d.previousQuarter} />
        </Section>

        <Section id="people" n="02" title="People at risk" intro="Everyone, riskiest first. Open a person to see why, and what might help.">
          <PeopleTable departments={departments} />
        </Section>

        <Section
          id="concentration"
          n="03"
          title="Where risk concentrates"
          intro="Average risk score for each role, by department. Hover or focus a cell for headcount and expected cost at the replacement rate above."
        >
          <Heatmap cells={cells} />
        </Section>

        <Section
          id="keep"
          n="04"
          title="What would keep people here"
          intro={`What people picked in the ${d.quarter} check-in, by department. Teams with fewer than five answers stay hidden.`}
        >
          <KeepThemes themes={d.keepThemes} />
        </Section>

        <Section
          id="trust"
          n="05"
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
      <div className="mt-10 grid grid-cols-12 gap-3 md:mt-14">
        <Skeleton className="col-span-12 h-80 lg:col-span-5 lg:h-auto" />
        <div className="col-span-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-7">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
      <div className="mt-16 border-t border-line pt-14 md:mt-24">
        <Skeleton className="h-10 w-80 max-w-full" />
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    </div>
  );
}
