"use client";

import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import type { PersonRow } from "@/lib/api";
import { pct } from "@/lib/format";
import { BandChip } from "../BandChip";

const TREND = {
  up: { Icon: ArrowUpRightIcon, tone: "text-signal", label: "Risen since last quarter" },
  down: { Icon: ArrowDownRightIcon, tone: "text-calm", label: "Fallen since last quarter" },
  flat: { Icon: ArrowRightIcon, tone: "text-muted", label: "About the same as last quarter" },
} as const;

/** One person. The whole row opens their page; the name is the keyboard link. */
export function PeopleRow({ p, onOpen }: { p: PersonRow; onOpen: () => void }) {
  const t = TREND[p.trend];
  return (
    <tr
      data-testid="person-row"
      data-id={p.id}
      onClick={onOpen}
      className="group cursor-pointer border-t border-line transition-colors duration-150 hover:bg-surface"
    >
      <td className="py-3 pr-3">
        <Link href={`/hr/people/${p.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium outline-offset-4 group-hover:underline group-hover:underline-offset-4">
          {p.name}
        </Link>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
          <span className="truncate md:hidden">{p.jobRole}</span>
          {!p.answered && (
            <span className="inline-flex shrink-0 items-center gap-1">
              <span className="size-1.5 rounded-full bg-mist" aria-hidden />
              No check-in yet
            </span>
          )}
        </span>
      </td>
      <td className="hidden truncate py-3 pr-3 text-ink-soft md:table-cell">{p.jobRole}</td>
      <td className="hidden truncate py-3 pr-3 text-ink-soft lg:table-cell">{p.department}</td>
      <td className="py-3 pr-3">
        <span className="flex items-center gap-3">
          <span className="tabular w-9 shrink-0 font-medium">{pct(p.riskScore)}</span>
          <span className="relative hidden h-1.5 flex-1 overflow-hidden rounded-full bg-line sm:block" aria-hidden>
            <span
              className={`absolute inset-y-0 left-0 rounded-full ${p.riskBand === "high" ? "bg-signal" : p.riskBand === "elevated" ? "bg-ink-soft/60" : "bg-mist"}`}
              style={{ width: `${p.riskScore * 100}%` }}
            />
          </span>
        </span>
      </td>
      <td className="hidden py-3 pr-3 sm:table-cell">
        <BandChip band={p.riskBand} />
      </td>
      <td className="py-3 text-right">
        <span className={`inline-flex ${t.tone}`} title={t.label}>
          <t.Icon size={16} weight="bold" aria-hidden />
          <span className="sr-only">{t.label}</span>
        </span>
      </td>
    </tr>
  );
}
