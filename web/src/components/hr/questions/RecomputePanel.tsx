"use client";

import { ArrowsClockwiseIcon, CheckCircleIcon, CircleNotchIcon, DatabaseIcon, HourglassMediumIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ApiError, fillSampleAnswers, recomputeScores, type QuestionStatus, type RecomputeResult } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { PillButton } from "@/components/ui/PillButton";
import { Coverage } from "./Coverage";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function message(e: unknown) {
  return e instanceof ApiError && e.status !== 0 ? e.message : "Couldn't reach the model. Check your connection.";
}

/** What the last recompute did: who was re-scored, who changed band, and how much better stay intent is predicted. */
function Result({ r, fresh }: { r: RecomputeResult; fresh: boolean }) {
  const auc = r.intentAuc;
  const stats = [
    { label: "People re-scored", value: int(r.rescored) },
    { label: "Changed risk band", value: int(r.bandChanges) },
    {
      label: "Company average",
      value: `${pct(r.meanRiskBefore)} → ${pct(r.meanRiskAfter)}`,
    },
    ...(auc ? [{ label: "Stay-intent accuracy", value: `${auc.baseOnly.toFixed(2)} → ${auc.withQuestions.toFixed(2)}` }] : []),
  ];
  return (
    <div data-testid="recompute-result" className={`border-t border-line px-6 py-6 md:px-10 md:py-7 ${fresh ? "bg-calm/[0.07]" : ""}`}>
      <p className="text-xs text-muted">
        {fresh ? "Just now" : "Last recompute"} · {when(r.computedAt)} · {r.questions} added{" "}
        {r.questions === 1 ? "question" : "questions"} in the scores
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="tabular mt-1 text-2xl font-semibold tracking-[-0.02em]">{s.value}</dd>
          </div>
        ))}
      </dl>
      {auc && (
        <p className="mt-4 max-w-[70ch] text-xs leading-relaxed text-muted">
          Accuracy is AUC on held-out people ({int(auc.n)} who gave a stay intent): how well the model alone, then the model
          with your questions, tells apart who expects to stay from who doesn&apos;t. 0.5 is a coin toss, 1 is perfect.
        </p>
      )}
    </div>
  );
}

const STEPS = [
  <>
    Every check-in also asks <span className="text-ink">&ldquo;A year from now, do you see yourself still working here?&rdquo;</span>
  </>,
  <>Recompute learns how each answer to your new questions shifts that, beyond what the model already knows.</>,
  <>Then it re-scores everyone. The company-wide average stays the same; people are re-ranked.</>,
];

/** The recompute: locked until enough people have answered, then one button folds the answers into every score. */
export function RecomputePanel({ status, onStatus }: { status: QuestionStatus; onStatus: (s: QuestionStatus) => void }) {
  const reduce = useReducedMotion();
  const { recompute: rc, coverageNeeded } = status;
  const [busy, setBusy] = useState<"recompute" | "sample" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [filled, setFilled] = useState<number | null>(null);
  const pending = status.questions.filter((q) => q.status === "pending");
  const waiting = rc.needed && !rc.ready;

  async function run() {
    setBusy("recompute");
    setError(null);
    try {
      onStatus(await recomputeScores());
      setFresh(true);
      setFilled(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  async function sample() {
    setBusy("sample");
    setError(null);
    try {
      const next = await fillSampleAnswers();
      onStatus(next);
      setFilled(next.filled);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  const kicker = !rc.needed ? "Up to date" : rc.ready ? "Ready" : "Waiting for answers";
  const Icon = !rc.needed ? CheckCircleIcon : rc.ready ? ArrowsClockwiseIcon : HourglassMediumIcon;
  const title = !rc.needed
    ? fresh
      ? "Done. Scores include every question."
      : "Scores include every question."
    : rc.ready
      ? "Ready to recompute."
      : `${pct(rc.coverage ?? 0)} answered so far.`;
  const sub = !rc.needed
    ? rc.last
      ? "Add a question below whenever you want to learn something new. It joins the scores once enough people answer it."
      : "Add a question below. Once enough people have answered it, recompute folds it into everyone's score."
    : rc.ready
      ? pending.length
        ? "Enough people have answered. Recompute learns from their answers and re-scores everyone."
        : "Removed questions leave the scores when you recompute."
      : `Each new question needs ${pct(coverageNeeded)} of current staff before the model can learn from it. This is the least-answered one.`;

  return (
    <section aria-labelledby="recompute-title" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid gap-10 p-6 md:p-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted">
            <Icon size={14} aria-hidden className={rc.ready ? "text-calm" : ""} />
            Recompute · {kicker}
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={title}
              id="recompute-title"
              initial={{ opacity: 0, transform: reduce ? "translateY(0px)" : "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="mt-4 max-w-[20ch] text-[clamp(1.875rem,3.6vw,3rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-balance"
            >
              {title}
            </motion.h2>
          </AnimatePresence>
          <p className="mt-3 max-w-[56ch] leading-relaxed text-muted">{sub}</p>

          {waiting && rc.coverage !== null && (
            <div className="mt-7 max-w-xl">
              <Coverage value={rc.coverage} needed={coverageNeeded} label="Least-answered new question" size="lg" />
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <PillButton
              type="button"
              variant="dark"
              onClick={run}
              disabled={!rc.ready || busy !== null}
              aria-describedby={!rc.ready && rc.reason ? "recompute-reason" : undefined}
              className="w-fit py-2 pl-6 text-base disabled:pointer-events-none disabled:opacity-35"
            >
              <span className="inline-flex items-center gap-2">
                {busy === "recompute" && <CircleNotchIcon size={16} className="animate-spin" aria-hidden />}
                {busy === "recompute" ? "Recomputing…" : "Recompute probabilities"}
              </span>
            </PillButton>
            {!rc.ready && rc.reason && (
              <p id="recompute-reason" className="max-w-[40ch] text-sm leading-snug text-muted">
                {rc.needed ? `Unlocks at ${pct(coverageNeeded)} answered.` : rc.reason}
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-5 text-sm text-signal">
              {error}
            </p>
          )}
        </div>

        <div className="min-w-0 border-line lg:border-l lg:pl-12">
          <p className="text-sm font-medium">How it learns</p>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-3.5 text-sm leading-relaxed text-ink-soft">
                <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-bg font-mono text-[11px] text-muted ring-1 ring-line">
                  {i + 1}
                </span>
                <span className="text-muted">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {rc.last && <Result r={rc.last} fresh={fresh} />}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-dashed border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <p className="text-xs leading-relaxed text-muted">
            Sample data for this showcase: answers for people who haven&apos;t responded yet.
            {filled !== null && (
              <span aria-live="polite" className="ml-1 text-ink-soft">
                {filled === 0 ? "Everyone had already answered." : `Filled in ${int(filled)} people.`}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={sample}
            disabled={busy !== null}
            className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink-soft transition-[transform,background-color] duration-150 ease-out hover:bg-bg active:scale-[0.97] disabled:opacity-50"
          >
            {busy === "sample" ? <CircleNotchIcon size={14} className="animate-spin" aria-hidden /> : <DatabaseIcon size={14} aria-hidden />}
            Fill sample answers
          </button>
        </div>
      )}
    </section>
  );
}
