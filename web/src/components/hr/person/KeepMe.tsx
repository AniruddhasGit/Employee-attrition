import { QuotesIcon } from "@phosphor-icons/react/dist/ssr";
import type { Person } from "@/lib/api";

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
    return <p className="text-muted">Nothing picked at the latest check-in.</p>;
  }
  return (
    <div data-testid="keep-me">
      <p className="mb-4 text-xs text-muted">Picked at the {latest.quarter} check-in</p>
      <ol className="flex flex-col">
        {latest.keepMe.map((k, i) => (
          <li key={k} className="flex items-baseline gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
            <span className="tabular font-mono text-xs text-muted">{i + 1}</span>
            <span className="text-lg font-medium tracking-[-0.01em]">{KEEP_LABELS[k] ?? k}</span>
          </li>
        ))}
      </ol>
      {latest.comment && (
        <blockquote className="mt-6 rounded-2xl bg-bg p-5 text-sm leading-relaxed text-ink-soft">
          <QuotesIcon size={18} weight="fill" className="mb-2 text-mist" aria-hidden />
          {latest.comment}
        </blockquote>
      )}
    </div>
  );
}
