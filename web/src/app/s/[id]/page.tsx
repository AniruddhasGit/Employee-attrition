import type { Metadata } from "next";
import { Suspense } from "react";
import { ScenarioView } from "@/components/share/ScenarioView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Shared scenario" };

export default function SharedScenarioPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1100px] px-4 pt-32"><Skeleton className="h-96" /></div>}>
      <ScenarioView />
    </Suspense>
  );
}
