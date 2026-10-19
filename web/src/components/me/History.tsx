import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr";
import type { KeepOption, MeHome } from "@/lib/api";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { ANSWER_ROWS, fmtQuarter } from "./labels";

/**
 * Every past answer, one column per quarter (newest first). Answers that changed since the quarter before are marked.
 * The heading and table rise in when scrolled to; rows tint softly under the pointer to help follow a line across.
 */
export function History({ history, options }: { history: MeHome["history"]; options: KeepOption[] }) {
  const label = (key: string) => options.find((o) => o.key === key)?.label ?? key;
  const sticky = "sticky left-0 z-10 bg-surface";
  // Opaque tint (sticky cells must stay solid) that follows the row under a fine pointer.
  const tint = "transition-colors duration-150 group-hover/row:bg-[color-mix(in_oklab,var(--surface),var(--ink)_3.5%)]";
  return (
    <section aria-labelledby="history-title">
      <Stagger>
        <StaggerItem className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="history-title" className="text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
              Your past answers
            </h2>
            <p className="mt-1.5 text-sm text-muted">Only you and HR see these.</p>
          </div>
          {history.length > 1 && (
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <span aria-hidden className="size-1.5 rounded-full bg-calm" />
              Changed from the quarter before
            </p>
          )}
        </StaggerItem>
        {history.length === 0 ? (
          <StaggerItem className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-line bg-surface p-6 text-ink-soft">
            <ClockCounterClockwiseIcon size={20} className="mt-0.5 shrink-0 text-calm" aria-hidden />
            Your answers show here after your first check-in.
          </StaggerItem>
        ) : (
          <StaggerItem className="relative mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="overflow-x-auto overscroll-x-contain">
              <table
                className="w-full table-fixed border-collapse text-left text-sm"
                style={{ minWidth: `calc(9.5rem + ${history.length} * 11rem)` }}
              >
                <colgroup>
                  <col className="w-[9.5rem] md:w-[30%]" />
                  {history.map((h) => (
                    <col key={h.quarter} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className={`${sticky} px-4 py-4 md:px-6`}>
                      <span className="sr-only">Question</span>
                    </th>
                    {history.map((h, i) => (
                      <th key={h.quarter} scope="col" className="px-4 py-4 md:px-5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] ${
                            i === 0 ? "bg-ink text-bg" : "text-muted"
                          }`}
                        >
                          {fmtQuarter(h.quarter)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ANSWER_ROWS.map((row) => (
                    <tr key={row.key} className="group/row border-b border-line">
                      <th scope="row" className={`${sticky} ${tint} px-4 py-3.5 font-normal leading-snug text-ink-soft md:px-6`}>
                        {row.label}
                      </th>
                      {history.map((h, i) => {
                        const older = history[i + 1];
                        const changed = older !== undefined && older.answers[row.key] !== h.answers[row.key];
                        return (
                          <td key={h.quarter} className={`${tint} px-4 py-3.5 md:px-5 ${changed ? "font-medium text-ink" : "text-muted"}`}>
                            <span className="inline-flex items-center gap-2">
                              {row.show(h.answers[row.key])}
                              {changed && (
                                <>
                                  <span aria-hidden className="size-1.5 rounded-full bg-calm" />
                                  <span className="sr-only">(changed)</span>
                                </>
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="align-top">
                    <th scope="row" className={`${sticky} px-4 py-4 font-normal leading-snug text-ink-soft md:px-6`}>
                      What would keep you here
                    </th>
                    {history.map((h) => (
                      <td key={h.quarter} className="px-4 py-4 md:px-5">
                        {h.keepMe.length ? (
                          <ul className="flex flex-wrap gap-1.5">
                            {h.keepMe.map((k) => (
                              <li key={k} className="whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-xs leading-none text-ink-soft">
                                {label(k)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted">None picked</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {history.length > 1 && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent md:hidden"
              />
            )}
          </StaggerItem>
        )}
      </Stagger>
    </section>
  );
}
