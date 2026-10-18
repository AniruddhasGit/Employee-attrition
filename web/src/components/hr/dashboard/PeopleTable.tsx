"use client";

import { CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, listPeople, type Band, type PersonRow } from "@/lib/api";
import { int } from "@/lib/format";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PeopleRow } from "./PeopleRow";

const PAGE = 12;
const BANDS: { value: Band | ""; label: string }[] = [
  { value: "", label: "Everyone" },
  { value: "high", label: "High" },
  { value: "elevated", label: "Elevated" },
  { value: "low", label: "Low" },
];

type Query = { search: string; department: string; band: Band | ""; page: number };
type Loaded = { key: string; items: PersonRow[]; total: number } | { key: string; error: ApiError };

/** Everyone, riskiest first, with search, a department filter, band chips and paging. */
export function PeopleTable({ departments }: { departments: string[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [q, setQ] = useState<Query>({ search: "", department: "", band: "", page: 0 });
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [rows, setRows] = useState<{ items: PersonRow[]; total: number } | null>(null);
  const key = JSON.stringify([q, attempt]);

  // Debounce typing so each keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => setQ((p) => (p.search === text.trim() ? p : { ...p, search: text.trim(), page: 0 })), 200);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    let alive = true;
    listPeople({
      search: q.search,
      department: q.department || undefined,
      band: q.band || undefined,
      limit: PAGE,
      offset: q.page * PAGE,
    })
      .then((r) => {
        if (!alive) return;
        setLoaded({ key, ...r });
        setRows(r);
      })
      .catch((e) => alive && setLoaded({ key, error: e instanceof ApiError ? e : new ApiError(0, "Something went wrong.") }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const busy = loaded?.key !== key;
  const error = !busy && loaded && "error" in loaded ? loaded.error : null;
  const total = rows?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const from = total === 0 ? 0 : q.page * PAGE + 1;
  const to = Math.min(total, (q.page + 1) * PAGE);

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <label className="relative flex items-center border-b border-line transition-colors duration-150 focus-within:border-ink sm:w-72">
            <MagnifyingGlassIcon size={16} className="pointer-events-none absolute left-0 text-muted" aria-hidden />
            <input
              type="search"
              aria-label="Search people"
              placeholder="Search by name"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-11 w-full bg-transparent py-2 pl-6 text-sm outline-none placeholder:text-muted"
            />
          </label>
          <label className="flex items-center gap-3 border-b border-line text-sm transition-colors duration-150 focus-within:border-ink">
            <span className="text-muted">Department</span>
            <select
              value={q.department}
              onChange={(e) => setQ((p) => ({ ...p, department: e.target.value, page: 0 }))}
              className="min-h-11 min-w-0 flex-1 cursor-pointer bg-transparent py-2 outline-none"
            >
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div role="group" aria-label="Risk band" className="flex w-fit flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
          {BANDS.map((b) => {
            const on = q.band === b.value;
            return (
              <button
                key={b.label}
                type="button"
                aria-pressed={on}
                onClick={() => setQ((p) => ({ ...p, band: b.value, page: 0 }))}
                className={`relative isolate min-h-9 rounded-full px-4 text-sm transition-[color,transform] duration-150 ease-out active:scale-[0.97] ${
                  on ? "text-bg" : "text-ink-soft hover:text-ink"
                }`}
              >
                {on && (
                  <motion.span
                    layoutId="band-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-ink"
                    transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.35, bounce: 0.15 }}
                  />
                )}
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        {error ? (
          <ErrorState message={error.message} status={error.status} onRetry={() => setAttempt((a) => a + 1)} />
        ) : !rows ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3" aria-busy>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className={`w-full table-fixed text-sm transition-opacity duration-200 ease-out ${busy ? "opacity-60" : ""}`} aria-busy={busy}>
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-muted">
                <th className="w-[50%] py-3.5 pl-4 font-medium md:w-[26%] md:pl-6">Name</th>
                <th className="hidden py-3.5 font-medium md:table-cell md:w-[20%]">Role</th>
                <th className="hidden py-3.5 font-medium lg:table-cell lg:w-[18%]">Department</th>
                <th className="py-3.5 font-medium">Risk score</th>
                <th className="hidden py-3.5 font-medium sm:table-cell sm:w-24">Band</th>
                <th className="w-20 py-3.5 pr-4 text-right font-medium sm:w-28 md:pr-6">
                  <span className="hidden sm:inline">Since last</span>
                  <span className="sm:hidden">Trend</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.items.map((p) => (
                <PeopleRow key={p.id} p={p} onOpen={() => router.push(`/hr/people/${p.id}`)} />
              ))}
              {rows.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="border-t border-line px-4 py-14 text-center">
                    <span className="mx-auto grid size-11 place-items-center rounded-full bg-haze/40 text-muted" aria-hidden>
                      <UsersThreeIcon size={20} />
                    </span>
                    <span className="mt-3 block font-medium">No one matches</span>
                    <span className="mt-1 block text-muted">Clear the search or pick another band.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {rows && total > 0 && (
        <div className="mt-6 flex items-center justify-between gap-4 text-sm">
          <p className="tabular text-muted">
            {int(from)}–{int(to)} of {int(total)}
          </p>
          <div className="flex items-center gap-2">
            <PageButton label="Previous page" disabled={q.page === 0} onClick={() => setQ((p) => ({ ...p, page: p.page - 1 }))}>
              <CaretLeftIcon size={14} />
            </PageButton>
            <span className="tabular min-w-16 text-center text-muted">
              {q.page + 1} / {pages}
            </span>
            <PageButton label="Next page" disabled={q.page + 1 >= pages} onClick={() => setQ((p) => ({ ...p, page: p.page + 1 }))}>
              <CaretRightIcon size={14} />
            </PageButton>
          </div>
        </div>
      )}
    </div>
  );
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full border border-line bg-surface transition-[background-color,border-color,transform] duration-150 ease-out hover:border-ink/25 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 sm:size-10"
    >
      {children}
    </button>
  );
}
