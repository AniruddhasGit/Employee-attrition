"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useRef, type KeyboardEvent } from "react";
import type { Option, Question as Q } from "@/lib/api";

const COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

/**
 * One check-in question as a radio group of large tiles. Arrow keys move the choice (as native radios do),
 * Home/End jump to the ends, Enter moves on.
 */
export function Question({
  question,
  value,
  onChange,
  onEnter,
  labelledBy,
}: {
  question: Q;
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
          <button
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
            className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left outline-none transition-[transform,translate,scale,background-color,border-color,color,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-calm focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.97] md:p-5 ${
              count ? "min-h-20 items-center justify-center" : scale ? "min-h-28 md:min-h-36" : "min-h-20 md:min-h-28"
            } ${
              on
                ? "border-ink bg-ink text-bg shadow-[0_14px_32px_-16px_rgb(14_17_22/0.55)]"
                : "border-line bg-surface text-ink hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_10px_24px_-18px_rgb(14_17_22/0.45)]"
            }`}
          >
            {scale && <Level n={i + 1} on={on} />}
            {scale && (
              <span
                aria-hidden
                className={`absolute right-4 top-4 grid size-5 place-items-center rounded-full bg-bg text-ink transition-[transform,translate,scale,opacity] duration-200 ease-out md:right-5 md:top-5 ${
                  on ? "scale-100 opacity-100" : "scale-75 opacity-0"
                }`}
              >
                <CheckIcon size={12} weight="bold" />
              </span>
            )}
            {!scale && !count && (
              <span
                aria-hidden
                className={`grid size-5 place-items-center rounded-full border transition-colors duration-150 ${on ? "border-bg bg-bg text-ink" : "border-line"}`}
              >
                <CheckIcon size={12} weight="bold" className={`transition-[transform,translate,scale,opacity] duration-200 ease-out ${on ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} />
              </span>
            )}
            <span className={count ? "text-2xl font-semibold tabular-nums tracking-[-0.02em]" : "mt-6 text-lg font-medium leading-tight"}>
              {count && o.label === "6 or more" ? "6+" : o.label}
            </span>
          </button>
        );
      })}
    </div>
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
