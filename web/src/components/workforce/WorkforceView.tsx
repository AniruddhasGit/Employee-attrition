"use client";

import { getMetrics, getWorkforce } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { ErrorState } from "@/components/ui/ErrorState";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { CostLens } from "./CostLens";
import { Heatmap } from "./Heatmap";
import { Hypotheses } from "./Hypotheses";
import { RiskDistribution } from "./RiskDistribution";
import { SegmentCompare } from "./SegmentCompare";
import { TopDrivers } from "./TopDrivers";

async function load() {
  const [wf, metrics] = await Promise.all([getWorkforce(50), getMetrics()]);
  return { wf, threshold: metrics.threshold };
}

function Block({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-16 md:py-24">
      <Reveal>
        <h2 className="max-w-[24ch] text-[clamp(1.75rem,3.2vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.03em]">{title}</h2>
        {intro && <p className="mt-4 max-w-[60ch] leading-relaxed text-muted">{intro}</p>}
      </Reveal>
      <div className="mt-10">{children}</div>
    </section>
  );
}

export function WorkforceView() {
  const { data, error, retry } = useApi(load);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-32 md:px-8">
      <h1 className="text-[clamp(2.5rem,6vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
        The whole workforce.
      </h1>
      {error && <div className="mt-10"><ErrorState message={error.message} onRetry={retry} /></div>}
      {!data && !error && <Skeleton className="mt-10 h-[60vh]" />}
      {data && (
        <>
          <dl className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              ["People", int(data.wf.headcount)],
              ["Actually left", `${int(data.wf.leavers)} (${pct(data.wf.leavers / data.wf.headcount, 1)})`],
              ["Average risk score", pct(data.wf.meanRisk, 1)],
              ["Flag line", pct(data.threshold)],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-line pt-3">
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="tabular mt-1 text-3xl font-semibold tracking-[-0.02em]">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-16">
            <Block title="Where risk concentrates" intro="Average risk score for each role, by department. Hover or focus a cell for headcount and expected cost.">
              <Heatmap cells={data.wf.heatmap} />
            </Block>
            <Block title="How risk is spread" intro="Most people sit well below the flag line. The ones above it are where attention goes first.">
              <RiskDistribution bins={data.wf.distribution} threshold={data.threshold} />
            </Block>
            <Block title="What raises risk most often" intro="Share of people for whom each factor is among those pushing their score up.">
              <TopDrivers drivers={data.wf.topDrivers} />
            </Block>
            <Block title="What it might cost">
              <CostLens wf={data.wf} />
            </Block>
            <Block title="Compare two groups" intro="Pick any two slices of the workforce. Groups smaller than 10 people are flagged.">
              <SegmentCompare />
            </Block>
            <Block title="Ideas worth testing" intro="Each idea answers one of the factors above. They are hypotheses for a real organisation to test, not proven fixes.">
              <Hypotheses />
            </Block>
          </div>
          <Disclaimer />
        </>
      )}
    </div>
  );
}
