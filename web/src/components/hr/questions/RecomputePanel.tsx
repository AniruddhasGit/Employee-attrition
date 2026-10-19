"use client";

import { ArrowsClockwiseIcon, CheckCircleIcon, CircleNotchIcon, DatabaseIcon, HourglassMediumIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ApiError, fillSampleAnswers, recomputeScores, type QuestionStatus, type RecomputeResult } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { EASE_IN_OUT, EASE_OUT } from "@/lib/motion";
import { PillButton } from "@/components/ui/PillButton";
import { CountUp, Stagger, StaggerItem } from "@/components/ui/motion";
import { Coverage } from "./Coverage";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function message(e: unknown) {
  return e instanceof ApiError && e.status !== 0 ? e.message : "Couldn't reach the model. Check your connection.";
}

/** A figure that counts in when the recompute has just run, and is plain text otherwise. */
function Figure({ value, from = 0, format, live }: { value: number; from?: number; format: (v: number) => string; live: boolean }) {
  return live ? <CountUp value={value} from={from} format={format} duration={1} /> : <>{format(value)}</>;
}

/** Stay-intent AUC on a 0.5 (coin toss) to 1 (perfect) track: a hollow mark where it was, the fill sweeping to where it is. */
function AucTrack({ before, after, live }: { before: number; after: number; live: boolean }) {
  const reduce = useReducedMotion();
  const at = (v: number) => Math.min(1, Math.max(0, (v - 0.5) / 0.5));
  const start = live && !reduce ? at(before) : at(after);
  return (
    <span className="relative mt-3 block h-1.5 rounded-full bg-haze/60" aria-hidden>
      <motion.span
        className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-calm"
        initial={{ scaleX: start }}
        whileInView={{ scaleX: at(after) }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: reduce ? 0 : 0.9, delay: 0.15, ease: EASE_OUT }}
      />
      <span
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink/60 bg-surface"
        style={{ left: `${at(before) * 100}%` }}
      />
    </span>
  );
}

/** What the last recompute did: who was re-scored, who changed band, and how much better stay intent is predicted. */
function Result({ r, fresh }: { r: RecomputeResult; fresh: boolean }) {
  const auc = r.intentAuc;
  const two = (v: number) => v.toFixed(2);
  const stats = [
    { label: "People re-scored", value: <Figure value={r.rescored} format={int} live={fresh} /> },
    { label: "Changed risk band", value: <Figure value={r.bandChanges} format={int} live={fresh} /> },
    {
      label: "Company average",
      value: (
        <>
          {pct(r.meanRiskBefore)} → <Figure value={r.meanRiskAfter} from={r.meanRiskBefore} format={(v) => pct(v)} live={fresh} />
        </>
      ),
    },
    ...(auc
      ? [
          {
            label: "Stay-intent accuracy",
            value: (
              <>
                {two(auc.baseOnly)} → <Figure value={auc.withQuestions} from={auc.baseOnly} format={two} live={fresh} />
              </>
            ),
            extra: <AucTrack before={auc.baseOnly} after={auc.withQuestions} live={fresh} />,
          },
        ]
      : []),
  ];
  return (
    <div data-testid="recompute-result" className={`border-t border-line px-6 py-6 transition-colors duration-500 md:px-10 md:py-7 ${fresh ? "bg-calm/[0.07]" : ""}`}>
      <p className="text-xs text-muted">
        {fresh ? "Just now" : "Last recompute"} · {when(r.computedAt)} · {r.questions} added{" "}
        {r.questions === 1 ? "question" : "questions"} in the scores
      </p>
      <Stagger as="dl" onMount gap={0.06} className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="tabular mt-1 text-2xl font-semibold tracking-[-0.02em]">{s.value}</dd>
            {"extra" in s && s.extra}
          </StaggerItem>
        ))}
      </Stagger>
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
    <section aria-labelledby="recompute-title" aria-busy={busy === "recompute"} className="relative overflow-hidden rounded-2xl border border-line bg-surface">
      {/* While the model re-learns: a hairline sweeps the top edge of the panel. */}
      <AnimatePresence>
        {busy === "recompute" && (
          <motion.span
            key="sweep"
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            {reduce ? (
              <span className="absolute inset-0 bg-ink/40" />
            ) : (
              <motion.span
                className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-[linear-gradient(90deg,transparent,var(--ink),transparent)]"
                initial={{ x: "-100%" }}
                animate={{ x: "250%" }}
                transition={{ duration: 1.2, ease: EASE_IN_OUT, repeat: Infinity }}
              />
            )}
          </motion.span>
        )}
      </AnimatePresence>
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
              <span className="inline-flex items-center">
                <AnimatePresence initial={false}>
                  {busy === "recompute" && (
                    <motion.span
                      key="spin"
                      className="mr-2 inline-flex"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0 } }}
                      transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
                    >
                      <CircleNotchIcon size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
                    </motion.span>
                  )}
                </AnimatePresence>
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

      <div className={`transition-opacity duration-300 ${busy === "recompute" ? "opacity-45" : ""}`}>
        <AnimatePresence initial={false} mode="wait">
          {rc.last && (
            <motion.div
              key={rc.last.computedAt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              <Result r={rc.last} fresh={fresh} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
