"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CheckInStatus } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";

type Update = CheckInStatus["updates"][number];

/** Posted "you said, we did" notes, newest first. A fresh post slides in at the top. */
export function UpdateList({ updates }: { updates: Update[] }) {
  const reduce = useReducedMotion();

  if (updates.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-8 text-sm text-muted">
        No updates yet. The first one you post shows up here and on that department&apos;s home pages.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      <AnimatePresence initial={false}>
        {updates.map((u) => (
          <motion.li
            key={u.id}
            layout={!reduce}
            data-testid="update"
            initial={{ opacity: 0, transform: reduce ? "translateY(0px)" : "translateY(-12px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="rounded-2xl border border-line bg-surface p-5 md:p-6"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full border border-line px-2.5 py-0.5 text-ink-soft">{u.department}</span>
              <span className="tabular">{u.quarter}</span>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-6">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted uppercase">You said</dt>
                <dd className="mt-1.5 leading-relaxed break-words">{u.said}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-calm uppercase">We did</dt>
                <dd className="mt-1.5 leading-relaxed break-words">{u.did}</dd>
              </div>
            </dl>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
