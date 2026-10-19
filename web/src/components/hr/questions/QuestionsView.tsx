"use client";

import { useState } from "react";
import { getQuestions, type QuestionStatus } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ErrorState } from "@/components/ui/ErrorState";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { CrossFade } from "../CrossFade";
import { Composer } from "./Composer";
import { CoreQuestions } from "./CoreQuestions";
import { QuestionList } from "./QuestionList";
import { RecomputePanel } from "./RecomputePanel";

function Loading() {
  return (
    <div aria-busy aria-label="Loading questions" className="space-y-16">
      <Skeleton className="h-80" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          <Skeleton className="h-8 w-1/2 rounded-full" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-[28rem] lg:col-span-5" />
      </div>
    </div>
  );
}

/** HR's added check-in questions: the recompute up top, the questions, and the form to add more. */
export function QuestionsView() {
  const { data, error, loading, retry } = useApi(getQuestions);
  // Every change returns the whole status; keep the latest one over what the page loaded with.
  const [latest, setLatest] = useState<QuestionStatus | null>(null);

  if (!loading && (error || !data)) return <ErrorState message={error?.message} status={error?.status} onRetry={retry} />;
  if (!data) {
    return (
      <CrossFade id="loading">
        <Loading />
      </CrossFade>
    );
  }

  const status = latest ?? data;
  const asked = status.questions.filter((q) => q.status !== "removed").length;

  return (
    <CrossFade id="loaded">
    <div className="space-y-16 md:space-y-24">
      <Reveal y={16}>
        <RecomputePanel status={status} onStatus={setLatest} />
      </Reveal>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-12 lg:gap-4">
        <section aria-labelledby="added-title" className="min-w-0 lg:col-span-7 lg:pr-8">
          <Reveal y={16} className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="added-title" className="text-[clamp(1.875rem,3.5vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em]">
                Added questions
              </h2>
              <p className="mt-3 max-w-[56ch] leading-relaxed text-muted">
                Pending questions are asked from the next check-in but don&apos;t touch anyone&apos;s score until you recompute.
              </p>
            </div>
            <p className="tabular text-sm text-muted">
              {asked} of {status.maxQuestions} asked
            </p>
          </Reveal>
          <QuestionList status={status} onStatus={setLatest} />
        </section>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:col-span-5">
          <Composer status={status} onStatus={setLatest} />
          <CoreQuestions intent={status.intentQuestion} />
        </div>
      </div>
    </div>
    </CrossFade>
  );
}
