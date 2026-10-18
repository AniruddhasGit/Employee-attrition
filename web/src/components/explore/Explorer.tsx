"use client";

import { ShuffleIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { listEmployees, randomEmployee, type Band, type EmployeeCard } from "@/lib/api";
import { int } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { useApi } from "@/lib/useApi";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PersonCard } from "./PersonCard";

const DEPARTMENTS = ["All", "Sales", "Research & Development", "Human Resources"];
const BANDS: ("All" | Band)[] = ["All", "high", "elevated", "low"];
const PAGE = 24;

function Pills<T extends string>({
  label,
  options,
  value,
  onChange,
  render = (v) => v,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`rounded-full px-3.5 py-1.5 text-sm transition-colors duration-150 ease-out ${
            o === value ? "bg-ink text-bg" : "border border-line text-ink-soft hover:bg-surface"
          }`}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

const bandName = (b: "All" | Band) => (b === "All" ? "All" : b[0].toUpperCase() + b.slice(1));

export function Explorer() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [department, setDepartment] = useState("All");
  const [band, setBand] = useState<"All" | Band>("All");
  const [limit, setLimit] = useState(PAGE);

  const { data, error, loading, retry } = useApi(
    () =>
      listEmployees({
        department: department === "All" ? undefined : department,
        band: band === "All" ? undefined : band,
        sort: "risk",
        limit,
      }),
    [department, band, limit],
  );
  const [items, setItems] = useState<EmployeeCard[]>([]);
  const [total, setTotal] = useState(0);
  if (data && (data.items !== items || data.total !== total)) {
    // Keep the last result on screen while the next one loads, so the grid can animate between them.
    setItems(data.items);
    setTotal(data.total);
  }

  async function shuffle() {
    const e = await randomEmployee(band === "All" ? undefined : band).catch(() => null);
    if (e) router.push(`/explore/${e.id}`);
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-32 md:px-8">
      <div className="grid grid-cols-12 gap-y-6">
        <h1 className="col-span-12 text-[clamp(2.5rem,6vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.045em] md:col-span-8">
          Explore {int(1470)} people.
        </h1>
        <p className="col-span-12 max-w-[46ch] leading-relaxed text-muted md:col-span-8">
          Every score comes from a model that never saw that person. Sorted by risk. Open anyone to
          see why, and to try changing what an employer could change.
        </p>
      </div>

      <div className="sticky top-0 z-30 -mx-4 mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-bg/85 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Pills label="Department" options={DEPARTMENTS} value={department} onChange={(v) => (setDepartment(v), setLimit(PAGE))} />
          <Pills label="Risk band" options={BANDS} value={band} onChange={(v) => (setBand(v), setLimit(PAGE))} render={bandName} />
        </div>
        <button
          type="button"
          onClick={shuffle}
          className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm hover:bg-surface"
        >
          <ShuffleIcon size={14} /> Surprise me
        </button>
      </div>

      <p className="mt-6 text-sm text-muted" aria-live="polite">
        {loading && !items.length ? "Loading people" : `${int(total)} people`}
      </p>

      {error && !items.length && (
        <div className="mt-6">
          <ErrorState message={error.message} status={error.status} onRetry={retry} />
        </div>
      )}

      {!items.length && loading && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      )}

      <motion.ul layout={!reduce} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((e, i) => (
            <motion.li
              key={e.id}
              layout={!reduce}
              initial={{ opacity: 0, transform: reduce ? "none" : "translateY(12px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.03, ease: EASE_OUT }}
            >
              <PersonCard e={e} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {items.length < total && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((l) => Math.min(l + PAGE, 100))}
            disabled={limit >= 100}
            className="rounded-full border border-line px-5 py-2 text-sm hover:bg-surface disabled:opacity-40"
          >
            {limit >= 100 ? "Narrow the filters to see more" : "Show more"}
          </button>
        </div>
      )}
      <Disclaimer className="mt-12" />
    </div>
  );
}
