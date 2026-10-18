"use client";

import { getMetrics } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ErrorState } from "@/components/ui/ErrorState";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { CalibrationPlot } from "./CalibrationPlot";
import { FairnessTable } from "./FairnessTable";
import { MetricsCI } from "./MetricsCI";
import { ThresholdExplorer } from "./ThresholdExplorer";

const limits = (leavers: number) => [
  ["The data is fictional.", "IBM made it up to teach analytics. Nothing here describes a real company, and the numbers will not transfer to one without retraining."],
  ["It finds associations, not causes.", "When the simulator lowers a score, it shows how the model reacts, not what would make a real person stay."],
  ["The test set is small.", `Only ${leavers} people in it left, so every metric carries a wide range. Treat the second decimal as noise.`],
  ["It is not for judging individuals.", "Use it, at most, to see patterns across groups and decide what to look into."],
];

function Block({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-16 md:py-24">
      <Reveal>
        <h2 className="max-w-[24ch] text-[clamp(1.75rem,3.2vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.03em]">{title}</h2>
        <p className="mt-4 max-w-[60ch] leading-relaxed text-muted">{intro}</p>
      </Reveal>
      <div className="mt-10">{children}</div>
    </section>
  );
}

export function HonestyView() {
  const { data: m, error, retry } = useApi(getMetrics);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-32 md:px-8">
      <h1 className="max-w-[14ch] text-[clamp(2.5rem,6vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
        How good is this, honestly?
      </h1>
      <p className="mt-6 max-w-[56ch] leading-relaxed text-muted">
        Every number on this page was measured on {m ? m.nTest : "294"} people the model never saw
        during training.
      </p>
      {error && <div className="mt-10"><ErrorState message={error.message} onRetry={retry} /></div>}
      {!m && !error && <Skeleton className="mt-10 h-[60vh]" />}
      {m && (
        <div className="mt-16">
          <Block title="The scores, with their uncertainty" intro="Dots are the honest model. Bars are the range the true value plausibly falls in. Hollow dots are what the original notebook would have claimed.">
            <MetricsCI m={m} />
          </Block>
          <Block title="Choosing where to draw the line" intro="Drag the threshold or hover the chart. The model's own line was picked on training data to balance precision and recall.">
            <ThresholdExplorer m={m} />
          </Block>
          <Block title="Does a 30% score mean 30%?" intro="If the model is calibrated, dots sit on the diagonal: people given a 30% risk score leave about 30% of the time.">
            <CalibrationPlot bins={m.calibration} />
          </Block>
          <Block title="Does it treat groups differently?" intro="Gender, age and marital status are never inputs to the model. Even so, it catches leavers unevenly across groups, because other factors stand in for them.">
            <FairnessTable slices={m.fairness} />
          </Block>
          <Block title="What it can't do" intro="The limits matter as much as the scores.">
            <ul className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {limits(m.nTestPos).map(([title, body]) => (
                <li key={title} className="border-t border-line pt-4">
                  <p className="font-medium">{title}</p>
                  <p className="mt-2 leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </Block>
        </div>
      )}
    </div>
  );
}
