import { QuotesIcon } from "@phosphor-icons/react/dist/ssr";
import type { Person } from "@/lib/api";
import { Reveal } from "@/components/ui/Reveal";

/** Labels for the keep-me choices; mirrors KEEP_ME in api/scoring.py (the HR API returns keys only). */
const KEEP_LABELS: Record<string, string> = {
  pay: "Pay",
  growth: "Growth and promotion",
  flexibility: "Flexible hours or remote work",
  recognition: "Recognition",
  manager: "A better manager relationship",
  less_overtime: "Less overtime",
  learning: "Learning and training",
  less_travel: "Less travel",
  security: "Job security",
};

/** What the person picked at their latest check-in, in their order, plus their comment if they left one. */
export function KeepMe({ checkIns }: { checkIns: Person["checkIns"] }) {
  const latest = checkIns.at(-1);
  if (!latest || latest.keepMe.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
        <p className="font-medium">Nothing picked yet</p>
        <p className="mt-1 text-sm text-muted">What they choose at their next check-in will show here, in their order.</p>
      </div>
    );
  }
  return (
    <div data-testid="keep-me">
      <p className="mb-5 text-xs text-muted">Picked at the {latest.quarter} check-in, in their order</p>
      <ol className="flex flex-col gap-2">
        {latest.keepMe.map((k, i) => (
          <Reveal as="li" key={k} y={8} delay={i * 0.06}>
            <div
              className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 ${
                i === 0 ? "bg-ink text-bg" : "border border-line bg-surface"
              }`}
            >
              <span
                className={`tabular grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs ${
                  i === 0 ? "bg-bg/15 text-bg" : "bg-bg text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className="text-[1.0625rem] font-medium tracking-[-0.01em]">{KEEP_LABELS[k] ?? k}</span>
            </div>
          </Reveal>
        ))}
      </ol>
      {latest.comment && (
        <figure className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <QuotesIcon size={20} weight="fill" className="text-mist" aria-hidden />
          <blockquote className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{latest.comment}</blockquote>
          <figcaption className="mt-3 text-xs text-muted">Their comment, {latest.quarter}</figcaption>
        </figure>
      )}
    </div>
  );
}
