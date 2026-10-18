"use client";

import { CheckIcon } from "@phosphor-icons/react/dist/ssr";
import { motion, useReducedMotion } from "motion/react";
import type { MeHome } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";

/** "2026-Q4" stepped back n quarters. */
function back(q: string, n: number): string {
  const [y, p] = q.split("-Q").map(Number);
  const i = y * 4 + (p - 1) - n;
  return `${Math.floor(i / 4)}-Q${(i % 4) + 1}`;
}

const SPAN = 5;

/** The last five quarters as a row of marks: answered, open now, or skipped. */
export function CheckInRecord({ quarter, status, history }: { quarter: string; status: "open" | "done"; history: MeHome["history"] }) {
  const reduce = useReducedMotion();
  const answered = new Set(history.map((h) => h.quarter));
  const quarters = Array.from({ length: SPAN }, (_, i) => back(quarter, SPAN - 1 - i));
  const count = quarters.filter((q) => answered.has(q)).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        Your check-ins · {count} of {SPAN} quarters
      </p>
      <ol className="flex items-end gap-2" aria-label="Check-ins over the last five quarters">
        {quarters.map((q, i) => {
          const done = answered.has(q);
          const now = q === quarter;
          const [y, p] = q.split("-");
          return (
            <motion.li
              key={q}
              initial={{ opacity: 0, transform: reduce ? "none" : "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.4, delay: 0.25 + i * 0.05, ease: EASE_OUT }}
              className="flex flex-col items-center gap-2"
            >
              <span
                className={`grid size-10 place-items-center rounded-full md:size-11 ${
                  done
                    ? "bg-ink text-bg"
                    : now && status === "open"
                      ? "border border-dashed border-ink/50 text-ink"
                      : "border border-line text-mist"
                }`}
              >
                {done ? (
                  <CheckIcon size={15} weight="bold" aria-hidden />
                ) : now ? (
                  <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-ink" />
                ) : (
                  <span aria-hidden className="h-px w-3 bg-mist" />
                )}
                <span className="sr-only">
                  {p} {y}: {done ? "answered" : now ? "open now" : "not answered"}
                </span>
              </span>
              <span aria-hidden className={`font-mono text-[10px] tabular-nums tracking-[0.06em] ${now ? "text-ink" : "text-muted"}`}>
                {p} &rsquo;{y.slice(2)}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
