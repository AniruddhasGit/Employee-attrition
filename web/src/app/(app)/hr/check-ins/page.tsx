import type { Metadata } from "next";
import { CheckInsView } from "@/components/hr/checkins/CheckInsView";

export const metadata: Metadata = { title: "Check-ins" };

export default function Page() {
  return (
    <div className="route-enter mx-auto max-w-[1400px] px-4 pt-10 pb-24 md:px-8 md:pt-14">
      <header className="mb-10 max-w-2xl md:mb-14">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Check-ins</h1>
        <p className="mt-3 leading-relaxed text-muted">
          Who has answered this quarter, who hasn&apos;t yet, and what you&apos;ve told each department in return.
        </p>
      </header>
      <CheckInsView />
    </div>
  );
}
