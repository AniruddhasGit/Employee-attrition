import type { Metadata } from "next";
import { QuestionsView } from "@/components/hr/questions/QuestionsView";

export const metadata: Metadata = { title: "Questions" };

export default function Page() {
  return (
    <div className="route-enter mx-auto max-w-[1400px] px-4 pt-10 pb-24 md:px-8 md:pt-14">
      <header className="mb-10 max-w-3xl md:mb-14">
        <h1 className="text-[clamp(2.25rem,5vw,4.5rem)] leading-[0.95] font-semibold tracking-[-0.045em]">Questions</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted md:text-lg">
          Ask your people something the model doesn&apos;t cover yet. Once enough of them have answered, fold the answers
          into everyone&apos;s score.
        </p>
      </header>
      <QuestionsView />
    </div>
  );
}
