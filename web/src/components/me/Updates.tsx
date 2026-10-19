"use client";

import { ArrowDownRightIcon, CaretDownIcon, MegaphoneSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import type { TeamNote } from "@/lib/api";
import { Reveal } from "@/components/ui/Reveal";
import { fmtQuarter } from "./labels";

/** Quarters shown before "Show earlier changes". */
const SHOWN = 2;

/** "You said, we did": what HR changed for this department, newest first, grouped by quarter on a timeline. */
export function Updates({ updates, department }: { updates: TeamNote[]; department: string }) {
  const [all, setAll] = useState(false);
  const groups: { quarter: string; notes: TeamNote[] }[] = [];
  for (const u of updates) {
    const g = groups.at(-1);
    if (g && g.quarter === u.quarter) g.notes.push(u);
    else groups.push({ quarter: u.quarter, notes: [u] });
  }

  return (
    <section aria-labelledby="updates-title" className="rounded-2xl border border-line bg-surface p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="updates-title" className="text-xl font-semibold tracking-[-0.015em]">
            You said, we did
          </h2>
          <p className="mt-1 text-sm text-muted">What HR changed for {department}.</p>
        </div>
        {updates.length > 0 && (
          <span className="shrink-0 rounded-full border border-line px-3 py-1 font-mono text-xs tabular-nums text-muted">
            {updates.length} {updates.length === 1 ? "change" : "changes"}
          </span>
        )}
      </div>

      {updates.length === 0 ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-line px-5 py-6 text-sm leading-relaxed text-ink-soft">
          <MegaphoneSimpleIcon size={18} className="mt-0.5 shrink-0 text-calm" aria-hidden />
          Nothing posted for your team yet. When HR acts on what people said, it shows here.
        </div>
      ) : (
        <>
        <ol id="updates-list" className="relative mt-8">
          <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-line" />
          {(all ? groups : groups.slice(0, SHOWN)).map((g, gi) => (
            <Reveal as="li" key={g.quarter} y={10} delay={(gi < SHOWN ? gi : gi - SHOWN) * 0.05} className="relative pb-8 pl-8 last:pb-0">
              <span
                aria-hidden
                className={`absolute left-0 top-1 size-[11px] rounded-full border-2 ${gi === 0 ? "border-calm bg-calm" : "border-haze bg-surface"}`}
              />
              <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{fmtQuarter(g.quarter)}</h3>
              <ul className="mt-3 flex flex-col gap-3">
                {g.notes.map((u, i) => (
                  <li
                    key={i}
                    className="group/note rounded-xl bg-bg/70 p-4 ring-1 ring-transparent transition-[background-color,box-shadow] duration-200 ease-out hover:bg-bg hover:ring-line md:p-5"
                  >
                    <p className="text-[15px] leading-relaxed text-muted">&ldquo;{u.said}&rdquo;</p>
                    <p className="mt-2.5 flex gap-2.5 font-medium leading-snug text-ink">
                      <ArrowDownRightIcon
                        size={16}
                        weight="bold"
                        className="mt-0.5 shrink-0 text-calm transition-transform duration-200 ease-out group-hover/note:translate-x-0.5 group-hover/note:translate-y-0.5 motion-reduce:group-hover/note:translate-0"
                        aria-hidden
                      />
                      <span>{u.did}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </ol>
        {groups.length > SHOWN && (
          <button
            type="button"
            aria-expanded={all}
            aria-controls="updates-list"
            onClick={() => setAll((v) => !v)}
            className="ml-8 mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink-soft outline-none transition-[transform,translate,scale,background-color,border-color,color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-calm focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97] hover:border-ink/30 hover:text-ink"
          >
            {all ? "Show fewer" : `Show earlier changes (${groups.slice(SHOWN).reduce((n, g) => n + g.notes.length, 0)})`}
            <CaretDownIcon
              size={14}
              aria-hidden
              className={`transition-transform duration-200 ease-out ${all ? "rotate-180" : "rotate-0"}`}
            />
          </button>
        )}
        </>
      )}
    </section>
  );
}
