import { CheckCircleIcon, ClockIcon, LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { PillButton } from "@/components/ui/PillButton";
import { fmtQuarter } from "./labels";

/** This quarter's check-in: an invitation while open, a quiet confirmation once done. */
export function StatusCard({ quarter, status }: { quarter: string; status: "open" | "done" }) {
  const q = fmtQuarter(quarter);
  if (status === "done") {
    return (
      <div className="flex flex-col gap-8 rounded-2xl border border-line bg-surface p-6 md:flex-row md:items-end md:justify-between md:p-10">
        <div className="flex items-start gap-4">
          <CheckCircleIcon size={32} weight="fill" className="mt-1 shrink-0 text-calm" aria-hidden />
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{q} check-in</p>
            <p className="mt-2 max-w-[28ch] text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-3xl">
              Done for {q}. You can update it until the quarter ends.
            </p>
          </div>
        </div>
        <PillButton href="/me/check-in" className="w-fit">
          Update my answers
        </PillButton>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-2xl bg-night p-6 text-night-ink md:p-12">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-calm/25 blur-3xl" />
      <p className="relative font-mono text-xs uppercase tracking-[0.14em] text-night-ink/60">{q} check-in · open</p>
      <p className="relative mt-4 max-w-[18ch] text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
        How is this quarter going for you?
      </p>
      <p className="relative mt-5 max-w-[48ch] leading-relaxed text-night-ink/70">
        Eight short questions, then what would keep you here. Your answers help HR decide what to fix next.
      </p>
      <div className="relative mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
        <PillButton href="/me/check-in" className="w-fit">
          Start this quarter&apos;s check-in
        </PillButton>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-night-ink/70">
          <li className="inline-flex items-center gap-2">
            <ClockIcon size={16} aria-hidden /> About two minutes
          </li>
          <li className="inline-flex items-center gap-2">
            <LockSimpleIcon size={16} aria-hidden /> Your manager doesn&apos;t see it
          </li>
        </ul>
      </div>
    </div>
  );
}
