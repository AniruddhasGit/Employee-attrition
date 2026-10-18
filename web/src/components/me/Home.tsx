"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ApiError, getMe, type MeHome } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { History } from "./History";
import { KeepMe } from "./KeepMe";
import { StatusCard } from "./StatusCard";
import { Updates } from "./Updates";

type State = { status: "loading" } | { status: "error"; error: ApiError } | { status: "ready"; data: MeHome };

const shell = "mx-auto max-w-[1400px] px-4 pb-24 pt-10 md:px-8 md:pt-16";

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
    <div className={shell}>
      <Reveal y={12}>
        <p className="text-sm text-muted">
          {d.jobRole} · {d.department}
        </p>
        <h1 className="mt-3 text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.045em]">Hi, {first}.</h1>
      </Reveal>

      <Reveal y={16} delay={0.06} className="mt-10 md:mt-14">
        <StatusCard quarter={d.quarter} status={d.checkInStatus} />
      </Reveal>

      <div className="mt-6 grid gap-6 md:grid-cols-12 md:items-start">
        <Reveal y={16} delay={0.12} className="md:col-span-5">
          <KeepMe keepMe={d.keepMe} comment={d.comment} options={d.keepMeOptions} quarter={d.history[0]?.quarter ?? null} />
        </Reveal>
        <Reveal y={16} delay={0.18} className="md:col-span-7">
          <Updates updates={d.updates} department={d.department} />
        </Reveal>
      </div>

      <Reveal y={16} className="mt-16 md:mt-20">
        <History history={d.history} options={d.keepMeOptions} />
      </Reveal>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className={shell} aria-busy="true">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-4 h-16 w-72 md:h-20 md:w-96" />
      <Skeleton className="mt-10 h-64 md:mt-14 md:h-72" />
      <div className="mt-6 grid gap-6 md:grid-cols-12">
        <Skeleton className="h-72 md:col-span-5" />
        <Skeleton className="h-72 md:col-span-7" />
      </div>
      <Skeleton className="mt-16 h-6 w-48 md:mt-20" />
      <Skeleton className="mt-6 h-96" />
    </div>
  );
}
