import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import type { FairnessSlice } from "@/lib/api";
import { int, pct } from "@/lib/format";

const GROUP_LABEL: Record<FairnessSlice["group"], string> = {
  Gender: "Gender",
  AgeBand: "Age",
  MaritalStatus: "Marital status",
};

/** Recall per group, shown as a dot on a hairline (no filled track) next to the numbers. */
export function FairnessTable({ slices }: { slices: FairnessSlice[] }) {
  const groups = [...new Set(slices.map((s) => s.group))];
  return (
    <div data-testid="fairness-table" className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="pb-3 font-normal">Group</th>
            <th className="pb-3 text-right font-normal">People</th>
            <th className="pb-3 text-right font-normal">Actually left</th>
            <th className="pb-3 text-right font-normal">Flagged</th>
            <th className="pb-3 pl-6 font-normal">Leavers caught (recall)</th>
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
                  <td className="text-right">{int(s.n)}</td>
                  <td className="text-right">{pct(s.attrition_rate)}</td>
                  <td className="text-right">{pct(s.flag_rate)}</td>
                  <td className="pl-6">
                    {s.recall === null ? (
                      "n/a"
                    ) : (
                      <span className="flex items-center gap-3">
                        <span className="relative h-3 w-40">
                          <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
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
