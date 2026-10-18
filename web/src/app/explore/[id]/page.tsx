import type { Metadata } from "next";
import { Suspense } from "react";
import { Simulator, SimulatorSkeleton } from "@/components/explore/Simulator";

export const metadata: Metadata = { title: "What-if simulator" };

export default function EmployeePage() {
  return (
    <Suspense fallback={<SimulatorSkeleton />}>
      <Simulator />
    </Suspense>
  );
}
