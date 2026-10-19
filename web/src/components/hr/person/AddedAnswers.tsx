import type { Person } from "@/lib/api";
import { odds } from "@/lib/format";

const STATUS: Record<Person["addedQuestions"][number]["status"], string> = {
  pending: "Not in the scores yet",
  active: "In the scores",
  removed: "Removed, leaves the scores at the next recompute",
};

/** Odds effect of one answer, raising in the signal colour and lowering in calm. */
export function OddsChip({ ratio }: { ratio: number }) {
  const { text, tone } = odds(ratio);
  const cls = tone === "raises" ? "bg-signal-soft text-signal" : tone === "lowers" ? "bg-calm/15 text-calm" : "bg-haze/50 text-muted";
  return (
    <span
      title="How this answer multiplies the odds of leaving, against a typical answer"
      className={`tabular inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {tone === "none" ? "no effect" : text}
    </span>
  );
}

/** Stay intent and answers to the questions HR added, each with its effect once it is in the scores. */
export function AddedAnswers({ added, intent }: { added: Person["addedQuestions"]; intent: Person["stayIntent"] }) {
  if (!intent && added.length === 0) return null;
  const leaning = intent ? (intent.value >= 4 ? "text-signal" : intent.value <= 2 ? "text-calm" : "text-ink") : "";
  return (
    <div data-testid="added-answers" className="mt-10 grid gap-4 md:grid-cols-12">
      {intent && (
        <div className="self-start rounded-2xl border border-line bg-surface p-5 md:col-span-4 md:p-6">
          <p className="text-xs text-muted">A year from now, still here?</p>
          <p className={`mt-2 text-2xl font-semibold tracking-[-0.02em] ${leaning}`}>{intent.label}</p>
          <p className="mt-2 text-xs text-muted">Stay intent, {intent.quarter}</p>
        </div>
      )}
      {added.length > 0 && (
        <div className={intent ? "md:col-span-8" : "md:col-span-12"}>
          <p className="mb-3 text-xs text-muted">Questions HR added, latest answer</p>
          <ul className="divide-y divide-line border-y border-line">
            {added.map((a) => (
              <li key={a.question} className="flex flex-col gap-1.5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-ink-soft">{a.question}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {a.quarter} · {STATUS[a.status]}
                  </p>
                </div>
                <p className="flex shrink-0 items-center gap-2 text-sm font-medium">
                  {a.answer}
                  {a.oddsRatio !== null && <OddsChip ratio={a.oddsRatio} />}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
