import { CaretDownIcon, LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import type { IntentQuestion } from "@/lib/api";

/** The check-in's built-in questions; mirrors QUESTIONS in api/checkins.py. */
const CORE = [
  "How satisfied are you with your work environment?",
  "How satisfied are you with your job itself?",
  "How good are your working relationships?",
  "How is your work-life balance?",
  "How involved do you feel in your work?",
  "Did you regularly work overtime this quarter?",
  "How often did you travel for work?",
  "How many training sessions did you attend in the last 12 months?",
];

/** Read-only, folded away: what every check-in asks before the questions HR added. */
export function CoreQuestions({ intent }: { intent: IntentQuestion }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-sm font-medium md:px-8 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2.5">
          <LockSimpleIcon size={15} aria-hidden className="text-muted" />
          Built into the model: {CORE.length} questions + stay intent
        </span>
        <CaretDownIcon size={14} aria-hidden className="shrink-0 text-muted transition-transform duration-200 ease-out group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-6 pt-5 pb-6 md:px-8">
        <ol className="space-y-2.5 text-sm text-ink-soft">
          {CORE.map((q, i) => (
            <li key={q} className="flex gap-3">
              <span className="tabular w-4 shrink-0 font-mono text-xs leading-5 text-muted">{i + 1}</span>
              {q}
            </li>
          ))}
        </ol>
        <div className="mt-5 border-t border-line pt-4 text-sm">
          <p className="text-ink-soft">{intent.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Stay intent: {intent.options.map((o) => o.label).join(" · ")}. Not part of the score itself; it is what a recompute
            learns from.
          </p>
        </div>
      </div>
    </details>
  );
}
