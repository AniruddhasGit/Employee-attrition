"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRef, type KeyboardEvent } from "react";
import type { Option, Question as Q } from "@/lib/api";
import { EASE_OUT, SPRING } from "@/lib/motion";

const COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3",
};

/**
 * One check-in question as a radio group of large tiles. Arrow keys move the choice (as native radios do),
 * Home/End jump to the ends, Enter moves on. The ink highlight glides to the chosen tile on a spring and the
 * check mark draws itself; tiles rise in one after another when the step appears. Reduced motion: no movement.
 */
export function Question({
  question,
  value,
  onChange,
  onEnter,
  labelledBy,
}: {
  /** A core question, or an added one ("choice": plain tiles, like yes/no). */
  question: { kind: Q["kind"] | "choice"; options: Option[] };
  value: Option["value"] | undefined;
  onChange: (v: Option["value"]) => void;
  onEnter: () => void;
  labelledBy: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const opts = question.options;
  const selected = opts.findIndex((o) => o.value === value);
  const scale = question.kind === "scale";
  const count = question.kind === "count";
  const reduce = useReducedMotion();

  function choose(i: number) {
    onChange(opts[i].value);
    refs.current[i]?.focus();
  }

  function onKeyDown(e: KeyboardEvent, i: number) {
    const last = opts.length - 1;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % opts.length
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i - 1 + opts.length) % opts.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (to !== null) {
      e.preventDefault();
      choose(to);
    } else if (e.key === "Enter" && selected !== -1) {
      e.preventDefault();
      onEnter();
    }
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={`grid gap-3 ${count ? "grid-cols-4 md:grid-cols-7" : COLS[opts.length] ?? "grid-cols-2"}`}>
      {opts.map((o, i) => {
        const on = i === selected;
        return (
          <motion.button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={count ? o.label : undefined}
            tabIndex={on || (selected === -1 && i === 0) ? 0 : -1}
            data-autofocus={on || (selected === -1 && i === 0) ? "" : undefined}
            onClick={() => choose(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            initial={reduce ? false : { opacity: 0, transform: "translateY(10px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.4, delay: 0.06 + i * 0.035, ease: EASE_OUT }}
            className={`group relative isolate flex flex-col justify-between rounded-2xl border p-4 text-left outline-none transition-[translate,scale,background-color,border-color,color,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-calm focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.97] motion-reduce:active:scale-100 md:p-5 ${
              count ? "min-h-20 items-center justify-center" : scale ? "min-h-28 md:min-h-36" : "min-h-20 md:min-h-28"
            } ${
              on
                ? `border-ink text-bg shadow-[0_14px_32px_-16px_rgb(14_17_22/0.55)] ${reduce ? "bg-ink" : "bg-surface"}`
                : "border-line bg-surface text-ink hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_10px_24px_-18px_rgb(14_17_22/0.45)] motion-reduce:hover:translate-y-0"
            }`}
          >
            {on && !reduce && (
              <motion.span
                aria-hidden
                layoutId={`${labelledBy}-pick`}
                transition={SPRING.snappy}
                className="absolute -inset-px -z-10 rounded-2xl bg-ink"
              />
            )}
            {scale && <Level n={i + 1} on={on} />}
            {scale && (
              <span
                aria-hidden
                className={`absolute right-4 top-4 grid size-5 place-items-center rounded-full bg-bg text-ink transition-[scale,opacity] duration-200 ease-out md:right-5 md:top-5 ${
                  on ? "scale-100 opacity-100" : "scale-75 opacity-0"
                }`}
              >
                <Tick on={on} reduce={!!reduce} />
              </span>
            )}
            {!scale && !count && (
              <span
                aria-hidden
                className={`grid size-5 place-items-center rounded-full border transition-colors duration-150 ${on ? "border-bg bg-bg text-ink" : "border-line"}`}
              >
                <Tick on={on} reduce={!!reduce} />
              </span>
            )}
            <span className={count ? "text-2xl font-semibold tabular-nums tracking-[-0.02em]" : "mt-6 text-lg font-medium leading-tight"}>
              {count && o.label === "6 or more" ? "6+" : o.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** A check mark whose stroke draws in when chosen and clears at once when not. */
function Tick({ on, reduce }: { on: boolean; reduce: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <motion.path
        d="M2.5 6.4 4.9 8.7 9.5 3.6"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={on && !reduce ? { duration: 0.24, delay: 0.08, ease: EASE_OUT } : { duration: 0 }}
      />
    </svg>
  );
}

/** Four rising bars, the first n filled: a quiet cue for where an answer sits on the scale. */
function Level({ n, on }: { n: number; on: boolean }) {
  return (
    <span aria-hidden className="flex h-6 items-end gap-1">
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          style={{ height: `${b * 25}%` }}
          className={`w-1.5 rounded-full transition-colors duration-150 ${
            b <= n ? (on ? "bg-bg" : "bg-ink") : on ? "bg-bg/25" : "bg-haze"
          }`}
        />
      ))}
    </span>
  );
}
