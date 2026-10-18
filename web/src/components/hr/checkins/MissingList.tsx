import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { CheckInStatus } from "@/lib/api";

type Missing = CheckInStatus["missing"];

/** People who haven't answered this quarter, grouped by department, each linking to their page. */
export function MissingList({ people }: { people: Missing }) {
  const groups = new Map<string, Missing>();
  for (const p of people) groups.set(p.department, [...(groups.get(p.department) ?? []), p]);

  return (
    <section
      aria-labelledby="missing-title"
      data-testid="missing"
      className="flex flex-col rounded-2xl border border-line bg-surface p-6 md:p-8"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="missing-title" className="text-xl font-semibold tracking-tight">
          Not answered yet
        </h2>
        <span className="tabular text-sm text-muted">{people.length}</span>
      </div>
      <p className="mt-1 text-sm text-muted">A nudge in person works better than a reminder email.</p>

      {people.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">Everyone has checked in this quarter.</p>
      ) : (
        <div data-lenis-prevent className="-mx-2 mt-6 max-h-[28rem] flex-1 overflow-y-auto overscroll-contain px-2">
          {[...groups].map(([dept, rows]) => (
            <div key={dept} className="mb-5 last:mb-0">
              <h3 className="sticky top-0 bg-surface py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                {dept} <span className="tabular">· {rows.length}</span>
              </h3>
              <ul>
                {rows.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/hr/people/${p.id}`}
                      className="group -mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition-colors duration-150 ease-out hover:bg-bg"
                    >
                      <span className="min-w-0">
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
