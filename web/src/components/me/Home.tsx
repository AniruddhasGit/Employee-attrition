"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ApiError, getMe, type MeHome } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { Stagger, StaggerItem, WordReveal } from "@/components/ui/motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { History } from "./History";
import { KeepMe } from "./KeepMe";
import { CheckInRecord } from "./CheckInRecord";
import { StatusCard } from "./StatusCard";
import { Updates } from "./Updates";

type State = { status: "loading" } | { status: "error"; error: ApiError } | { status: "ready"; data: MeHome };

const shell = "mx-auto max-w-[1400px] px-4 pb-28 pt-10 md:px-8 md:pt-16";

/** The employee's home: this quarter's check-in, what would keep them here, team updates and past answers. */
export function Home() {
  const [state, setState] = useState<State>({ status: "loading" });

  const fetchHome = useCallback(() => {
    getMe()
      .then((data) => setState({ status: "ready", data }))
      .catch((e) => setState({ status: "error", error: e instanceof ApiError ? e : new ApiError(0, "") }));
  }, []);

  useEffect(fetchHome, [fetchHome]);
  // Next keeps a route's state alive (hidden) after leaving it; show fresh data, not the old status, on return.
  useLayoutEffect(() => () => setState({ status: "loading" }), []);

  function retry() {
    setState({ status: "loading" });
    fetchHome();
  }

  if (state.status === "loading") return <HomeSkeleton />;
  if (state.status === "error") {
    return (
      <div className={shell}>
        <ErrorState status={state.error.status} message={state.error.message} onRetry={retry} />
      </div>
    );
  }

  const d = state.data;
  const first = d.displayName.split(" ")[0];
  return (
    // One orchestrated entrance: the greeting rises word by word while the cards follow in order.
    <Stagger onMount delay={0.05} gap={0.07} className={shell}>
      <header className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <StaggerItem>
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <span aria-hidden className="size-1.5 rounded-full bg-calm" />
              {d.jobRole} · {d.department}
            </p>
          </StaggerItem>
          <WordReveal
            text={`Hi, ${first}.`}
            delay={0.12}
            className="mt-3 text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.045em]"
          />
        </div>
        <StaggerItem>
          <CheckInRecord quarter={d.quarter} status={d.checkInStatus} history={d.history} />
        </StaggerItem>
      </header>

      <StaggerItem className="mt-10 md:mt-14">
        <StatusCard quarter={d.quarter} status={d.checkInStatus} newQuestions={d.newQuestions} />
      </StaggerItem>

      <div className="mt-6 grid gap-6 md:grid-cols-12 md:items-start">
        <StaggerItem className="md:sticky md:top-24 md:col-span-5">
          <KeepMe keepMe={d.keepMe} comment={d.comment} options={d.keepMeOptions} quarter={d.history[0]?.quarter ?? null} />
        </StaggerItem>
        <StaggerItem className="md:col-span-7">
          <Updates updates={d.updates} department={d.department} />
        </StaggerItem>
      </div>

      <div className="mt-16 md:mt-24">
        <History history={d.history} options={d.keepMeOptions} />
      </div>
    </Stagger>
  );
}

function HomeSkeleton() {
  return (
    <div className={shell} aria-busy="true">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-4 h-16 w-72 md:h-20 md:w-96" />
        </div>
        <Skeleton className="h-16 w-64" />
      </div>
      <Skeleton className="mt-10 h-64 md:mt-14 md:h-72" />
      <div className="mt-6 grid gap-6 md:grid-cols-12">
        <Skeleton className="h-72 md:col-span-5" />
        <Skeleton className="h-96 md:col-span-7" />
      </div>
      <Skeleton className="mt-16 h-6 w-48 md:mt-24" />
      <Skeleton className="mt-6 h-96" />
    </div>
  );
}
