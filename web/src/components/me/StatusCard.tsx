"use client";

import { CheckIcon, ClockIcon, LockSimpleIcon, SparkleIcon } from "@phosphor-icons/react/dist/ssr";
import { motion, useReducedMotion } from "motion/react";
import { PillButton } from "@/components/ui/PillButton";
import { EASE_OUT } from "@/lib/motion";
import { fmtQuarter } from "./labels";

/** This quarter's check-in: an invitation while open, a calm confirmation once done (with a nudge if HR added questions since). */
export function StatusCard({ quarter, status, newQuestions = 0 }: { quarter: string; status: "open" | "done"; newQuestions?: number }) {
  const reduce = useReducedMotion();
  const q = fmtQuarter(quarter);

  if (status === "done") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-40 size-[28rem] rounded-full bg-calm/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-5">
            <motion.span
              initial={{ opacity: 0, transform: reduce ? "scale(1)" : "scale(0.6)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.35, delay: 0.2 }}
              className="mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-calm text-surface shadow-[0_8px_24px_-8px_var(--calm)]"
            >
              <CheckIcon size={20} weight="bold" aria-hidden />
            </motion.span>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{q} check-in · sent</p>
              <p className="mt-2 max-w-[28ch] text-2xl font-semibold leading-tight tracking-[-0.025em] text-balance md:text-[2rem]">
                Done for {q}. You can update it until the quarter ends.
              </p>
              <p className="mt-3 max-w-[50ch] text-sm leading-relaxed text-muted">
                Thank you. HR reads every answer and posts what they change below.
              </p>
            </div>
          </div>
          {newQuestions === 0 && (
            <PillButton href="/me/check-in" className="w-fit shrink-0">
              Update my answers
            </PillButton>
          )}
        </div>
        {newQuestions > 0 && (
          <div
            data-testid="new-questions"
            className="relative mt-8 flex flex-col gap-5 rounded-2xl bg-ink p-5 text-bg sm:flex-row sm:items-center sm:justify-between md:p-6"
          >
            <div className="flex items-start gap-4">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-bg/15">
                <SparkleIcon size={18} weight="fill" />
              </span>
              <div>
                <p className="text-lg font-semibold leading-snug tracking-[-0.015em]">
                  HR added {newQuestions} new {newQuestions === 1 ? "question" : "questions"}.
                </p>
                <p className="mt-1 text-sm text-bg/70">Answer {newQuestions === 1 ? "it" : "them"} to update your check-in. It takes a minute.</p>
              </div>
            </div>
            <PillButton href="/me/check-in" className="w-fit shrink-0">
              Answer the new {newQuestions === 1 ? "question" : "questions"}
            </PillButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative isolate overflow-hidden rounded-2xl bg-night p-6 text-night-ink ring-1 ring-inset ring-white/10 md:p-12">
      <motion.div
        aria-hidden
        animate={reduce ? undefined : { transform: ["translate(0px, 0px)", "translate(-60px, 40px)", "translate(0px, 0px)"] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -right-24 -top-32 -z-10 size-[26rem] rounded-full bg-calm/35 blur-3xl"
      />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/3 -z-10 size-[22rem] rounded-full bg-series-1/20 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_left,black,transparent_70%)]"
      />

      <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-night-ink/60">
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-calm opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-calm" />
            </span>
            {q} check-in · open
          </p>
          <p className="mt-4 max-w-[18ch] text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-balance">
            How is this quarter going for you?
          </p>
          <p className="mt-5 max-w-[48ch] leading-relaxed text-night-ink/70">
            A few short questions, then what would keep you here. Your answers help HR decide what to fix next.
          </p>
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
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

        <Steps reduce={!!reduce} />
      </div>
    </div>
  );
}

/** A quiet preview of the flow: the questions, then the one choice at the end. */
function Steps({ reduce }: { reduce: boolean }) {
  return (
    <div aria-hidden className="hidden flex-col items-end gap-3 md:flex">
      <div className="flex items-end gap-1.5">
        {Array.from({ length: 9 }, (_, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, transform: reduce ? "scaleY(1)" : "scaleY(0.3)" }}
            animate={{ opacity: 1, transform: "scaleY(1)" }}
            transition={{ duration: 0.5, delay: 0.35 + i * 0.05, ease: EASE_OUT }}
            style={{ height: i === 8 ? 72 : 28 + ((i * 7) % 4) * 8, transformOrigin: "bottom" }}
            className={`w-3 rounded-full ${i === 8 ? "bg-calm" : "bg-night-ink/20"}`}
          />
        ))}
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-night-ink/50">Questions · 1 choice</p>
    </div>
  );
}
