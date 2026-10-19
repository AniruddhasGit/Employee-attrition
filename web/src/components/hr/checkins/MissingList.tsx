"use client";

import { ArrowUpRightIcon, CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { EASE_OUT } from "@/lib/motion";
import { motion, useReducedMotion } from "motion/react";
import type { CheckInStatus } from "@/lib/api";

type Missing = CheckInStatus["missing"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** People who haven't answered this quarter, grouped by department, each linking to their page. */
export function MissingList({ people }: { people: Missing }) {
  const reduce = useReducedMotion();
  const groups = new Map<string, Missing>();
  for (const p of people) groups.set(p.department, [...(groups.get(p.department) ?? []), p]);

  return (
    <section
      aria-labelledby="missing-title"
      data-testid="missing"
      className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 md:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="missing-title" className="text-xl font-semibold tracking-tight">
            Not answered yet
          </h2>
          <p className="mt-1 text-sm text-muted">A nudge in person works better than a reminder email.</p>
        </div>
        <span className="tabular shrink-0 text-3xl leading-none font-semibold tracking-tight">
          {people.length.toLocaleString()}
        </span>
      </div>

      {people.length === 0 ? (
        <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-bg px-6 py-12 text-center">
          <CheckCircleIcon size={28} weight="duotone" aria-hidden className="text-calm" />
          <p className="text-sm text-ink-soft">Everyone has checked in this quarter.</p>
        </div>
      ) : (
        <div className="relative mt-6 flex-1 lg:min-h-[20rem]">
          <div
            data-lenis-prevent
            className="-mx-2 max-h-[26rem] overflow-y-auto overscroll-contain px-2 pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)] lg:absolute lg:inset-0 lg:mx-0 lg:max-h-none lg:px-0"
          >
            {[...groups].map(([dept, rows], i) => (
              // Each team's group rises in as it scrolls into view inside the list.
              <motion.div
                key={dept}
                className="mb-5 last:mb-0"
                initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: "some" }}
                transition={{ duration: reduce ? 0.2 : 0.5, delay: reduce ? 0 : 0.1 + Math.min(i, 4) * 0.07, ease: EASE_OUT }}
              >
                <h3 className="sticky top-0 z-10 flex items-center justify-between bg-surface py-2 text-xs font-medium tracking-wide text-muted uppercase">
                  <span>{dept}</span>
                  <span className="tabular">{rows.length}</span>
                </h3>
                <ul>
                  {rows.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/hr/people/${p.id}`}
                        className="group flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 transition-[background-color,transform] duration-150 ease-out hover:bg-bg active:scale-[0.99]"
                      >
                        <span
                          aria-hidden
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-haze/60 text-[11px] font-semibold text-ink-soft"
                        >
                          {initials(p.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-muted">{p.jobRole}</span>
                        </span>
                        <ArrowUpRightIcon
                          size={16}
                          aria-hidden
                          className="shrink-0 text-mist transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
