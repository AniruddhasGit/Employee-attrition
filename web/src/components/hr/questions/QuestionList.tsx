"use client";

import { CircleNotchIcon, TrashIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ApiError, removeQuestion, type AddedQuestion, type QuestionStatus } from "@/lib/api";
import { int } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { OddsChip } from "@/components/hr/person/AddedAnswers";
import { Coverage } from "./Coverage";

const CHIP: Record<AddedQuestion["status"], { text: string; cls: string }> = {
  pending: { text: "Pending · not in the scores yet", cls: "border border-line bg-bg text-ink-soft" },
  active: { text: "In the scores", cls: "bg-ink text-bg" },
  removed: { text: "Removed · in the scores until recompute", cls: "border border-dashed border-line text-muted" },
};

const CONFIRM: Record<"pending" | "active", string> = {
  pending: "It isn't in anyone's score yet, so it goes at once, with the answers collected so far.",
  active: "Employees stop seeing it now. Its effect stays in the scores until you recompute.",
};

function Card({ q, headcount, needed, onStatus }: { q: AddedQuestion; headcount: number; needed: number; onStatus: (s: QuestionStatus) => void }) {
  const reduce = useReducedMotion();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chip = CHIP[q.status];

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const next = await removeQuestion(q.id);
      // An active question stays listed (as removed), so close the confirmation; a pending one simply goes.
      setConfirming(false);
      onStatus(next);
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 0 ? e.message : "Couldn't remove it. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      data-testid="added-question"
      className={`rounded-2xl border border-line p-5 md:p-6 ${q.status === "removed" ? "bg-transparent" : "bg-surface"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip.cls}`}>{chip.text}</span>
          <span className="tabular text-xs text-muted">Added {q.createdQuarter}</span>
        </div>
        {q.status !== "removed" && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="-mr-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted transition-[transform,background-color,color] duration-150 ease-out hover:bg-bg hover:text-ink active:scale-[0.97]"
          >
            <TrashIcon size={14} aria-hidden /> Remove
          </button>
        )}
      </div>

      <h3 className={`mt-4 text-lg font-semibold leading-snug tracking-[-0.015em] text-pretty ${q.status === "removed" ? "text-muted" : ""}`}>
        {q.label}
      </h3>

      <ul className="mt-4 flex flex-wrap gap-2">
        {q.options.map((o, i) => (
          <li key={o} className="inline-flex items-center gap-2 rounded-full border border-line bg-bg py-1 pl-3 pr-1 text-sm text-ink-soft">
            {o}
            {q.oddsRatios?.[i] !== undefined ? <OddsChip ratio={q.oddsRatios[i]} /> : <span className="w-2" />}
          </li>
        ))}
      </ul>
      {q.oddsRatios && q.status === "active" && (
        <p className="mt-3 text-xs text-muted">Each answer multiplies the odds of leaving, against a typical answer.</p>
      )}

      {q.status === "removed" ? (
        <p className="mt-5 text-sm text-muted">No longer asked. Its effect stays in the scores until you recompute.</p>
      ) : (
        <div className="mt-6">
          <Coverage value={q.coverage} needed={needed} label={`${int(q.answered)} of ${int(headcount)} people answered`} />
        </div>
      )}

      <AnimatePresence initial={false}>
        {confirming && (
          <motion.div
            initial={{ opacity: 0, transform: reduce ? "translateY(0px)" : "translateY(-4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            role="group"
            aria-label="Confirm removal"
            className="mt-5 rounded-xl border border-line bg-bg p-4"
          >
            <p className="text-sm font-medium">Remove this question?</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{CONFIRM[q.status as "pending" | "active"]}</p>
            {error && (
              <p role="alert" className="mt-2 text-sm text-signal">
                {error}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
              >
                {busy && <CircleNotchIcon size={14} className="animate-spin" aria-hidden />}
                Remove question
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                disabled={busy}
                className="inline-flex min-h-10 items-center rounded-full px-4 text-sm text-ink-soft transition-[transform,background-color] duration-150 ease-out hover:bg-surface active:scale-[0.97]"
              >
                Keep it
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

/** Every question HR has added, newest last, with how far each is from joining the scores. */
export function QuestionList({ status, onStatus }: { status: QuestionStatus; onStatus: (s: QuestionStatus) => void }) {
  const reduce = useReducedMotion();
  return (
    // New questions rise in, removed ones fold away, and the rest glide into place.
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false} mode="popLayout">
        {status.questions.map((q) => (
          <motion.div
            key={q.id}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.16, ease: EASE_OUT } }}
            transition={{ duration: 0.35, ease: EASE_OUT, layout: { duration: 0.3, ease: EASE_OUT } }}
          >
            <Card q={q} headcount={status.headcount} needed={status.coverageNeeded} onStatus={onStatus} />
          </motion.div>
        ))}
        {status.questions.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, delay: reduce ? 0 : 0.1, ease: EASE_OUT }}
            className="rounded-2xl border border-dashed border-line px-6 py-12 text-center"
          >
            <p className="font-medium">No questions added yet</p>
            <p className="mx-auto mt-1 max-w-[44ch] text-sm text-muted">
              Add one with the form on this page. Employees see it at their next check-in, after the built-in questions.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
