"use client";

import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import type { Ref } from "react";
import type { PersonRow } from "@/lib/api";
import { pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { BandChip } from "../BandChip";

const TREND = {
  up: { Icon: ArrowUpRightIcon, tone: "text-signal bg-signal-soft", label: "Risen since last quarter" },
  down: { Icon: ArrowDownRightIcon, tone: "text-calm bg-calm/12", label: "Fallen since last quarter" },
  flat: { Icon: ArrowRightIcon, tone: "text-muted bg-haze/40", label: "About the same as last quarter" },
} as const;

const BAR = { high: "bg-signal", elevated: "bg-ink-soft/55", low: "bg-mist" } as const;

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

/**
 * One person. The whole row opens their page; the name is the keyboard link.
 * Rows fade in a touch below their slot and glide when the list re-sorts (quick, no bounce).
 */
export function PeopleRow({ p, i, onOpen, ref }: { p: PersonRow; i: number; onOpen: () => void; ref?: Ref<HTMLTableRowElement> }) {
  const reduce = useReducedMotion();
  const t = TREND[p.trend];
  return (
    <motion.tr
      ref={ref}
      layout={reduce ? false : "position"}
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
      transition={{ duration: reduce ? 0 : 0.24, delay: reduce ? 0 : Math.min(i, 11) * 0.018, ease: EASE_OUT, layout: { duration: 0.24, ease: EASE_OUT } }}
      data-testid="person-row"
      data-id={p.id}
      onClick={onOpen}
      className="group cursor-pointer border-t border-line transition-colors duration-150 ease-out hover:bg-bg/70"
    >
      <td className="relative py-3 pl-4 pr-3 md:pl-6">
        {/* A hairline that draws in at the row's edge on hover, so the pointer's row reads at a glance. */}
        <span
          aria-hidden
          className="absolute inset-y-2.5 left-0 w-[2px] origin-center scale-y-0 rounded-full bg-ink transition-transform duration-200 ease-out group-hover:scale-y-100 motion-reduce:transition-none"
        />
        <span className="flex min-w-0 items-center gap-3">
          <span className="hidden size-9 shrink-0 place-items-center rounded-full bg-haze/45 text-[11px] font-semibold tracking-wide text-ink-soft sm:grid" aria-hidden>
            {initials(p.name)}
          </span>
          <span className="min-w-0">
            <Link
              href={`/hr/people/${p.id}`}
              onClick={(e) => e.stopPropagation()}
              className="block truncate font-medium outline-offset-4 decoration-ink/30 underline-offset-4 group-hover:underline"
            >
              {p.name}
            </Link>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              <span className="md:hidden">{p.jobRole}</span>
              {!p.answered && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <span className="size-1.5 rounded-full bg-mist" aria-hidden />
                  No check-in yet
                </span>
              )}
            </span>
          </span>
        </span>
      </td>
      <td className="hidden truncate py-3 pr-3 text-ink-soft md:table-cell">{p.jobRole}</td>
      <td className="hidden truncate py-3 pr-3 text-ink-soft lg:table-cell">{p.department}</td>
      <td className="py-3 pr-3">
        <span className="flex items-center gap-3">
          <span className={`tabular w-9 shrink-0 font-semibold ${p.riskBand === "high" ? "text-signal" : ""}`}>{pct(p.riskScore)}</span>
          <span className="relative hidden h-1.5 flex-1 overflow-hidden rounded-full bg-line sm:block" aria-hidden>
            <motion.span
              className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${BAR[p.riskBand]}`}
              initial={{ scaleX: reduce ? p.riskScore : 0 }}
              animate={{ scaleX: p.riskScore }}
              transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.08 + Math.min(i, 11) * 0.018, ease: EASE_OUT }}
            />
          </span>
        </span>
      </td>
      <td className="hidden py-3 pr-3 sm:table-cell">
        <BandChip band={p.riskBand} />
      </td>
      <td className="py-3 pr-4 text-right md:pr-6">
        <span className={`inline-grid size-7 place-items-center rounded-full ${t.tone}`} title={t.label}>
          <t.Icon size={14} weight="bold" aria-hidden />
          <span className="sr-only">{t.label}</span>
        </span>
      </td>
    </motion.tr>
  );
}
