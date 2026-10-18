"use client";

import { useState } from "react";
import { getCheckIns, type CheckInStatus as Status } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ErrorState } from "@/components/ui/ErrorState";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { CheckInStatus } from "./CheckInStatus";
import { MissingList } from "./MissingList";
import { UpdateComposer } from "./UpdateComposer";
import { UpdateList } from "./UpdateList";

type Update = Status["updates"][number];

function Loading() {
  return (
    <div aria-busy className="grid gap-4 lg:grid-cols-12">
      <Skeleton className="h-[30rem] lg:col-span-7" />
      <Skeleton className="h-[30rem] lg:col-span-5" />
      <Skeleton className="h-[26rem] lg:col-span-5" />
      <div className="space-y-3 lg:col-span-7">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}

export function CheckInsView() {
  const { data, error, loading, retry } = useApi(getCheckIns);
  // Updates posted on this visit, newest first, kept above what the server sent.
  const [posted, setPosted] = useState<Update[]>([]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error?.message} status={error?.status} onRetry={retry} />;

  const seen = new Set(posted.map((u) => u.id));
  const updates = [...posted, ...data.updates.filter((u) => !seen.has(u.id))];

  return (
    <div className="space-y-16 md:space-y-24">
      <div className="grid gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-7" y={16}>
          <CheckInStatus status={data} />
        </Reveal>
        <Reveal className="lg:col-span-5" y={16} delay={0.06}>
          <MissingList people={data.missing} />
        </Reveal>
      </div>

      <section aria-labelledby="said-did-title">
        <div className="mb-8 max-w-2xl">
          <h2 id="said-did-title" className="text-3xl font-semibold tracking-tight md:text-4xl">
            You said, we did
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            Check-ins only keep working if people see something come of them. Close the loop with a department: what
            they raised, and what changed.
          </p>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-12">
          <div className="lg:sticky lg:top-24 lg:col-span-5">
            <UpdateComposer
              departments={data.byDepartment.map((d) => d.department)}
              onPosted={(u) => setPosted((p) => [u, ...p])}
            />
          </div>
          <div className="lg:col-span-7">
            <UpdateList updates={updates} />
          </div>
        </div>
      </section>
    </div>
  );
}
