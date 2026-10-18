import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import type { FairnessSlice } from "@/lib/api";
import { int, pct } from "@/lib/format";

const GROUP_LABEL: Record<FairnessSlice["group"], string> = {
  Gender: "Gender",
  AgeBand: "Age",
  MaritalStatus: "Marital status",
};

/**
 * Recall per group, shown as a dot on a hairline (no filled track) next to the numbers.
 * With overallRecall, a tick marks the whole test set's recall so gaps read at a glance.
 */
export function FairnessTable({ slices, overallRecall }: { slices: FairnessSlice[]; overallRecall?: number }) {
  const groups = [...new Set(slices.map((s) => s.group))];
  return (
    <div data-testid="fairness-table">
      {overallRecall !== undefined && (
        <p className="mb-2 flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-series-1" aria-hidden /> Group
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px bg-ink" aria-hidden /> Everyone ({pct(overallRecall)})
          </span>
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="pb-3 font-normal">Group</th>
            <th className="hidden pb-3 text-right font-normal sm:table-cell">People</th>
            <th className="hidden pb-3 text-right font-normal sm:table-cell">Actually left</th>
            <th className="hidden pb-3 text-right font-normal md:table-cell">Flagged</th>
            <th className="pb-3 pl-4 font-normal sm:pl-6">Leavers caught (recall)</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g} className="tabular">
            <tr>
              <th colSpan={5} className="pb-1 pt-6 text-left font-medium">{GROUP_LABEL[g]}</th>
            </tr>
            {slices
              .filter((s) => s.group === g)
              .sort((a, b) => a.value.localeCompare(b.value))
              .map((s) => (
                <tr key={s.value} className="border-t border-line">
                  <td className="py-2.5">
                    {s.value}
                    {s.small_sample && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-signal">
                        <WarningIcon size={12} /> small group
                      </span>
                    )}
                  </td>
                  <td className="hidden text-right sm:table-cell">{int(s.n)}</td>
                  <td className="hidden text-right sm:table-cell">{pct(s.attrition_rate)}</td>
                  <td className="hidden text-right md:table-cell">{pct(s.flag_rate)}</td>
                  <td className="pl-4 sm:pl-6">
                    {s.recall === null ? (
                      "n/a"
                    ) : (
                      <span className="flex items-center gap-3">
                        <span className="relative h-3 w-24 sm:w-40">
                          <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
                          {overallRecall !== undefined && (
                            <span className="absolute inset-y-0 w-px bg-ink" style={{ left: `${overallRecall * 100}%` }} />
                          )}
                          <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-series-1" style={{ left: `${s.recall * 100}%` }} />
                        </span>
                        {pct(s.recall)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
