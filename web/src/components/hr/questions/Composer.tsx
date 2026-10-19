"use client";

import { CheckCircleIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, addQuestions, type QuestionStatus } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";
import { PillButton } from "@/components/ui/PillButton";

const LABEL_MIN = 5;
const LABEL_MAX = 160;
const OPTION_MAX = 60;
const OPTIONS_MIN = 2;
const OPTIONS_MAX = 6;

/** `ids` gives each option row a stable key, so rows animate in and out without the others re-mounting. */
type Draft = { key: number; label: string; options: string[]; ids: number[] };

let nextKey = 0;
const blank = (): Draft => ({ key: nextKey++, label: "", options: ["", ""], ids: [nextKey++, nextKey++] });

const fieldCls =
  "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-base leading-relaxed transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-mist focus:border-ink/40 focus:shadow-[0_0_0_3px_rgb(127_140_153/0.18)] focus:outline-none";

/** What's wrong with a draft, in the API's own limits, or null when it can go. */
function problem(d: Draft): string | null {
  const label = d.label.trim();
  const options = d.options.map((o) => o.trim());
  if (label.length < LABEL_MIN) return `Write the question (at least ${LABEL_MIN} characters).`;
  if (options.some((o) => !o)) return "Fill in every option, or remove the empty ones.";
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return "Each option must be different.";
  return null;
}

function DraftFields({
  d,
  n,
  showProblem,
  removable,
  onChange,
  onRemove,
}: {
  d: Draft;
  n: number;
  showProblem: boolean;
  removable: boolean;
  onChange: (d: Draft) => void;
  onRemove: () => void;
}) {
  const reduce = useReducedMotion();
  const issue = showProblem ? problem(d) : null;
  const setOption = (i: number, v: string) => onChange({ ...d, options: d.options.map((o, j) => (j === i ? v : o)) });
  return (
    <fieldset className="min-w-0 rounded-xl border border-line p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <legend className="float-left font-mono text-xs uppercase tracking-[0.14em] text-muted">Question {n}</legend>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove question ${n}`}
            className="-mr-1.5 grid size-8 place-items-center rounded-full text-muted transition-[transform,background-color,color] duration-150 ease-out hover:bg-bg hover:text-ink active:scale-[0.95]"
          >
            <XIcon size={14} aria-hidden />
          </button>
        )}
      </div>
      <label htmlFor={`q-${d.key}`} className="sr-only">
        Question {n} text
      </label>
      <textarea
        id={`q-${d.key}`}
        rows={2}
        maxLength={LABEL_MAX}
        value={d.label}
        placeholder="How supported do you feel by your manager?"
        onChange={(e) => onChange({ ...d, label: e.target.value })}
        aria-invalid={issue !== null && d.label.trim().length < LABEL_MIN}
        className={`mt-3 resize-none ${fieldCls}`}
      />
      <p className="mt-1 text-right text-[11px] tabular text-muted">
        {d.label.length}/{LABEL_MAX}
      </p>

      <p className="mt-2 text-sm font-medium">Answers people can pick</p>
      <ol className="mt-2 flex flex-col gap-2">
        <AnimatePresence initial={false} mode="popLayout">
        {d.options.map((o, i) => (
          <motion.li
            key={d.ids[i]}
            layout={reduce ? false : "position"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={{ duration: 0.22, ease: EASE_OUT, layout: { duration: 0.22, ease: EASE_OUT } }}
            className="flex items-center gap-2"
          >
            <span aria-hidden className="tabular w-4 shrink-0 text-center font-mono text-xs text-muted">
              {i + 1}
            </span>
            <input
              aria-label={`Question ${n}, option ${i + 1}`}
              value={o}
              maxLength={OPTION_MAX}
              placeholder={i === 0 ? "Very supported" : i === 1 ? "Not much" : "Another answer"}
              onChange={(e) => setOption(i, e.target.value)}
              className={`min-w-0 ${fieldCls}`}
            />
            <button
              type="button"
              onClick={() => onChange({ ...d, options: d.options.filter((_, j) => j !== i), ids: d.ids.filter((_, j) => j !== i) })}
              disabled={d.options.length <= OPTIONS_MIN}
              aria-label={`Remove option ${i + 1}`}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-[transform,background-color,color] duration-150 ease-out hover:bg-bg hover:text-ink active:scale-[0.95] disabled:invisible"
            >
              <XIcon size={13} aria-hidden />
            </button>
          </motion.li>
        ))}
        </AnimatePresence>
      </ol>
      {d.options.length < OPTIONS_MAX && (
        <motion.button
          layout={reduce ? false : "position"}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          type="button"
          onClick={() => onChange({ ...d, options: [...d.options, ""], ids: [...d.ids, nextKey++] })}
          className="mt-2 ml-5 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ink-soft transition-[transform,background-color] duration-150 ease-out hover:bg-bg active:scale-[0.97]"
        >
          <PlusIcon size={13} aria-hidden /> Add option
        </motion.button>
      )}
      {issue && (
        <p role="alert" className="mt-3 text-sm text-signal">
          {issue}
        </p>
      )}
    </fieldset>
  );
}

/** Write one or several multiple-choice questions and add them to the check-in in one go. */
export function Composer({ status, onStatus }: { status: QuestionStatus; onStatus: (s: QuestionStatus) => void }) {
  const reduce = useReducedMotion();
  const [drafts, setDrafts] = useState<Draft[]>(() => [blank()]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const asked = status.questions.filter((q) => q.status !== "removed").length;
  const room = status.maxQuestions - asked;

  useEffect(() => {
    if (added === null) return;
    const t = setTimeout(() => setAdded(null), 4000);
    return () => clearTimeout(t);
  }, [added]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (busy || drafts.some((d) => problem(d)) || drafts.length > room) return;
    setBusy(true);
    setError(null);
    try {
      const next = await addQuestions(drafts.map((d) => ({ label: d.label.trim(), options: d.options.map((o) => o.trim()) })));
      onStatus(next);
      setAdded(drafts.length);
      setDrafts([blank()]);
      setTried(false);
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0 ? err.message : "Couldn't add them. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (room <= 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 md:p-8">
        <h3 className="text-xl font-semibold tracking-tight">Add questions</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The check-in carries up to {status.maxQuestions} added questions, and all {status.maxQuestions} are in use. Remove one to
          add another.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-surface p-6 md:p-8">
      <h3 className="text-xl font-semibold tracking-tight">Add questions</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Multiple choice, 2 to 6 answers each. Employees see them at their next check-in. Room for {room} more.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <AnimatePresence initial={false} mode="popLayout">
          {drafts.map((d, i) => (
            <motion.div
              key={d.key}
              layout={reduce ? false : "position"}
              initial={{ opacity: 0, transform: reduce ? "translateY(0px)" : "translateY(8px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.25, ease: EASE_OUT, layout: { duration: 0.25, ease: EASE_OUT } }}
            >
              <DraftFields
                d={d}
                n={i + 1}
                showProblem={tried}
                removable={drafts.length > 1}
                onChange={(nd) => setDrafts((all) => all.map((x) => (x.key === nd.key ? nd : x)))}
                onRemove={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {drafts.length < room && (
        <button
          type="button"
          onClick={() => setDrafts((all) => [...all, blank()])}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm text-ink-soft transition-[transform,background-color,border-color] duration-150 ease-out hover:border-ink/30 hover:bg-bg active:scale-[0.99]"
        >
          <PlusIcon size={14} aria-hidden /> Add another question
        </button>
      )}

      {error && (
        <p role="alert" className="mt-5 text-sm text-signal">
          {error}
        </p>
      )}

      <div className="mt-6 flex min-h-11 flex-wrap items-center justify-between gap-4">
        <p aria-live="polite" className="min-w-0 text-sm text-ink-soft">
          <AnimatePresence>
            {added !== null && (
              <motion.span
                className="flex items-center gap-1.5"
                initial={{ opacity: 0, transform: reduce ? "translateY(0px)" : "translateY(4px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                <CheckCircleIcon size={16} weight="fill" aria-hidden className="shrink-0 text-calm" />
                Added {added} {added === 1 ? "question" : "questions"}
              </motion.span>
            )}
          </AnimatePresence>
        </p>
        <PillButton type="submit" variant="dark" disabled={busy} className="shrink-0 disabled:opacity-40">
          {busy ? "Adding…" : drafts.length === 1 ? "Add question" : `Add ${drafts.length} questions`}
        </PillButton>
      </div>
    </form>
  );
}
