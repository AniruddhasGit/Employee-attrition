"use client";

import { ArrowDownIcon, ArrowRightIcon, CaretDownIcon, ChatsCircleIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { CheckInStatus } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";

type Update = CheckInStatus["updates"][number];

export const ALL = "All departments";

/** Whole quarters open until at least this many cards show, before "Show earlier updates". */
const MIN_OPEN = 4;

function Filter({
  options,
  value,
  onChange,
}: {
  options: { label: string; count: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      role="group"
      aria-label="Show updates for"
      className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 md:[mask-image:none]"
    >
      {options.map((o) => {
        const on = o.label === value;
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.label)}
            className={`relative flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm whitespace-nowrap transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
              on ? "border-transparent text-bg" : "border-line text-ink-soft hover:border-ink/30 hover:text-ink"
            }`}
          >
            {on && (
              <motion.span
                layoutId="update-filter"
                aria-hidden
                className="absolute inset-0 rounded-full bg-ink"
                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.35, bounce: 0.15 }}
              />
            )}
            <span className="relative">{o.label}</span>
            <span className={`tabular relative text-xs ${on ? "text-bg/70" : "text-muted"}`}>{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function Card({ u, reduce }: { u: Update; reduce: boolean }) {
  return (
    <motion.li
      layout={!reduce ? "position" : false}
      data-testid="update"
      initial={{ opacity: 0, transform: reduce ? "translateY(0px)" : "translateY(-10px) scale(0.98)" }}
      animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="rounded-2xl border border-line bg-surface p-5 md:p-6"
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft">
        <span className="size-1.5 rounded-full bg-calm" aria-hidden />
        {u.department}
      </span>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1.15fr] md:items-stretch md:gap-4">
        <div className="md:py-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">You said</p>
          <p className="mt-1.5 leading-relaxed break-words text-ink-soft">&ldquo;{u.said}&rdquo;</p>
        </div>
        <span aria-hidden className="flex items-center text-mist md:justify-center">
          <ArrowDownIcon size={16} className="md:hidden" />
          <ArrowRightIcon size={16} className="hidden md:block" />
        </span>
        <div className="rounded-xl bg-calm/10 p-4">
          <p className="text-xs font-medium tracking-wide text-calm uppercase">We did</p>
          <p className="mt-1.5 leading-relaxed font-medium break-words">{u.did}</p>
        </div>
      </div>
    </motion.li>
  );
}

/** Posted "you said, we did" notes, newest first, grouped by quarter. A fresh post slides in at the top. */
export function UpdateList({
  updates,
  filter,
  onFilter,
}: {
  updates: Update[];
  filter: string;
  onFilter: (v: string) => void;
}) {
  const reduce = !!useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  if (updates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-8 py-16 text-center">
        <ChatsCircleIcon size={32} weight="duotone" aria-hidden className="text-calm" />
        <p className="font-medium">No updates posted yet</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          The first one you post shows up here and on that department&apos;s home pages.
        </p>
      </div>
    );
  }

  const counts = new Map<string, number>();
  for (const u of updates) counts.set(u.department, (counts.get(u.department) ?? 0) + 1);
  const options = [{ label: ALL, count: updates.length }, ...[...counts].sort().map(([label, count]) => ({ label, count }))];

  const shown = filter === ALL ? updates : updates.filter((u) => u.department === filter);
  const quarters = new Map<string, Update[]>();
  for (const u of shown) quarters.set(u.quarter, [...(quarters.get(u.quarter) ?? []), u]);
  const groups = [...quarters];
  let open = 0;
  for (let n = 0; open < groups.length && n < MIN_OPEN; open++) n += groups[open][1].length;
  const visible = expanded ? groups : groups.slice(0, open);
  const hidden = groups.slice(open).reduce((s, [, g]) => s + g.length, 0);

  return (
    <div>
      <Filter options={options} value={filter} onChange={onFilter} />
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-sm text-muted">
          Nothing posted for {filter} yet.
        </p>
      ) : (
        <div className="space-y-8">
          {visible.map(([quarter, items]) => (
            <section key={quarter} aria-label={`Updates from ${quarter}`}>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="tabular text-sm font-semibold">{quarter}</h3>
                <span className="h-px flex-1 bg-line" aria-hidden />
                <span className="tabular text-xs text-muted">
                  {items.length} {items.length === 1 ? "update" : "updates"}
                </span>
              </div>
              <ol className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {items.map((u) => (
                    <Card key={u.id} u={u} reduce={reduce} />
                  ))}
                </AnimatePresence>
              </ol>
            </section>
          ))}
          {hidden > 0 && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-line text-sm font-medium text-ink-soft transition-[color,background-color,transform] duration-150 ease-out hover:bg-surface hover:text-ink active:scale-[0.97]"
            >
              {expanded ? "Show fewer" : `Show ${hidden} earlier ${hidden === 1 ? "update" : "updates"}`}
              <CaretDownIcon
                size={14}
                aria-hidden
                className={`transition-transform duration-200 ease-out ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
