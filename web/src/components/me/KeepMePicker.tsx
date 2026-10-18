"use client";

import { CheckIcon, PlusIcon } from "@phosphor-icons/react";
import type { KeepOption } from "@/lib/api";

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
      <p className="text-sm text-muted" aria-live="polite">
        {picks.length} of {MAX_PICKS} picked{full ? ". Unpick one to change." : ""}
      </p>
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
                className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-5 text-[15px] outline-none transition-[transform,background-color,border-color,color,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-calm focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ${
                  on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink enabled:hover:border-ink/30"
                }`}
              >
                {on ? <CheckIcon size={14} weight="bold" aria-hidden /> : <PlusIcon size={14} aria-hidden className="text-muted" />}
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>

      <label className="mt-12 flex flex-col gap-2">
        <span className="text-sm text-muted">Anything else? (optional)</span>
        <textarea
          rows={3}
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          className="resize-none border-b border-line bg-transparent pb-2 text-lg leading-relaxed outline-none transition-colors duration-150 focus:border-ink"
        />
      </label>
      <p className={`mt-2 text-right font-mono text-xs tabular-nums ${comment.length >= MAX_COMMENT ? "text-ink" : "text-muted"}`}>
        {comment.length} / {MAX_COMMENT}
      </p>
    </div>
  );
}
