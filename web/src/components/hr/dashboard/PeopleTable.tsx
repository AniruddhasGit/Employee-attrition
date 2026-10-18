"use client";

import { CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
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
          <label className="relative flex items-center border-b border-line focus-within:border-ink sm:w-72">
            <MagnifyingGlassIcon size={16} className="pointer-events-none absolute left-0 text-muted" aria-hidden />
            <input
              type="search"
              aria-label="Search people"
              placeholder="Search by name"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-transparent py-2 pl-6 text-sm outline-none placeholder:text-muted"
            />
          </label>
          <label className="flex items-center gap-3 border-b border-line text-sm focus-within:border-ink">
            <span className="text-muted">Department</span>
            <select
              value={q.department}
              onChange={(e) => setQ((p) => ({ ...p, department: e.target.value, page: 0 }))}
              className="min-w-0 flex-1 cursor-pointer bg-transparent py-2 outline-none"
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
        <div role="group" aria-label="Risk band" className="flex flex-wrap gap-1.5">
          {BANDS.map((b) => {
            const on = q.band === b.value;
            return (
              <button
                key={b.label}
                type="button"
                aria-pressed={on}
                onClick={() => setQ((p) => ({ ...p, band: b.value, page: 0 }))}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
                  on ? "border-ink bg-ink text-bg" : "border-line text-ink-soft hover:bg-surface"
                }`}
              >
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
          <div className="flex flex-col gap-2" aria-busy>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : (
          <table className={`w-full table-fixed text-sm transition-opacity duration-200 ${busy ? "opacity-60" : ""}`} aria-busy={busy}>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="w-[46%] pb-3 font-normal md:w-[26%]">Name</th>
                <th className="hidden pb-3 font-normal md:table-cell md:w-[22%]">Role</th>
                <th className="hidden pb-3 font-normal lg:table-cell lg:w-[18%]">Department</th>
                <th className="pb-3 font-normal">Risk score</th>
                <th className="hidden pb-3 font-normal sm:table-cell sm:w-24">Band</th>
                <th className="w-16 pb-3 text-right font-normal sm:w-24">
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
                  <td colSpan={6} className="border-t border-line py-10 text-center text-muted">
                    No one matches. Clear the search or pick another band.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
      className="grid size-9 place-items-center rounded-full border border-line transition-[background-color,transform] duration-150 ease-out hover:bg-surface active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
