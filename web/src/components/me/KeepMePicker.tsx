"use client";

import { CheckIcon, PlusIcon } from "@phosphor-icons/react";
import type { KeepOption } from "@/lib/api";
import { KeepIcon } from "./keepIcons";

export const MAX_PICKS = 3;
export const MAX_COMMENT = 500;

/** Last step: up to three things that would keep this person here, plus an optional comment. */
export function KeepMePicker({
  options,
  picks,
  onPicks,
  comment,
  onComment,
}: {
  options: KeepOption[];
  picks: string[];
  onPicks: (p: string[]) => void;
  comment: string;
  onComment: (c: string) => void;
}) {
  const full = picks.length >= MAX_PICKS;

  function toggle(key: string) {
    onPicks(picks.includes(key) ? picks.filter((k) => k !== key) : [...picks, key]);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex gap-1">
          {Array.from({ length: MAX_PICKS }, (_, i) => (
            <span key={i} className="h-1.5 w-5 overflow-hidden rounded-full bg-haze/70">
              <span
                className="block h-full origin-left rounded-full bg-ink transition-transform duration-200 ease-out"
                style={{ transform: i < picks.length ? "scaleX(1)" : "scaleX(0)" }}
              />
            </span>
          ))}
        </span>
        <p className="text-sm text-muted" aria-live="polite">
          {picks.length} of {MAX_PICKS} picked{full ? ". Unpick one to change." : ""}
        </p>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2.5">
        {options.map((o) => {
          const on = picks.includes(o.key);
          return (
            <li key={o.key}>
              <button
                type="button"
                aria-pressed={on}
                disabled={full && !on}
                onClick={() => toggle(o.key)}
                className={`inline-flex min-h-12 items-center gap-2.5 rounded-full border pl-2 pr-5 text-[15px] outline-none transition-[transform,translate,scale,background-color,border-color,color,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-calm focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ${
                  on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink enabled:hover:border-ink/30"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid size-8 place-items-center rounded-full transition-colors duration-150 ${on ? "bg-bg/15 text-bg" : "bg-bg text-ink-soft"}`}
                >
                  <KeepIcon k={o.key} size={15} />
                </span>
                {o.label}
                {on ? <CheckIcon size={14} weight="bold" aria-hidden /> : <PlusIcon size={14} aria-hidden className="text-mist" />}
              </button>
            </li>
          );
        })}
      </ul>

      <label className="mt-10 flex flex-col gap-2.5">
        <span className="text-sm text-muted">Anything else? (optional)</span>
        <textarea
          rows={3}
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          placeholder="A sentence or two, in your own words."
          className="resize-none rounded-2xl border border-line bg-surface px-4 py-3.5 text-base leading-relaxed outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-mist hover:border-ink/30 focus:border-ink focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--calm)_18%,transparent)] md:px-5 md:py-4 md:text-lg"
        />
      </label>
      <p className={`mt-2 text-right font-mono text-xs tabular-nums ${comment.length >= MAX_COMMENT ? "text-ink" : "text-muted"}`}>
        {comment.length} / {MAX_COMMENT}
      </p>
    </div>
  );
}
