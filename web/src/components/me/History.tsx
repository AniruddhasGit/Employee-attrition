import type { KeepOption, MeHome } from "@/lib/api";
import { ANSWER_ROWS, fmtQuarter } from "./labels";

/** Every past answer, one column per quarter (newest first). Answers that changed since the quarter before are in ink. */
export function History({ history, options }: { history: MeHome["history"]; options: KeepOption[] }) {
  const label = (key: string) => options.find((o) => o.key === key)?.label ?? key;
  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title" className="text-xl font-semibold tracking-[-0.01em]">
        Your past answers
      </h2>
      <p className="mt-1 text-sm text-muted">Only you and HR see these. Changes from the quarter before are dark.</p>
      {history.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-6 text-ink-soft">
          Your answers show here after your first check-in.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-5 py-4 font-normal text-muted">
                  <span className="sr-only">Question</span>
                </th>
                {history.map((h) => (
                  <th key={h.quarter} scope="col" className="px-5 py-4 font-mono text-xs uppercase tracking-[0.12em] text-muted">
                    {fmtQuarter(h.quarter)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ANSWER_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-5 py-3.5 font-normal text-ink-soft">
                    {row.label}
                  </th>
                  {history.map((h, i) => {
                    const older = history[i + 1];
                    const changed = older !== undefined && older.answers[row.key] !== h.answers[row.key];
                    return (
                      <td key={h.quarter} className={`whitespace-nowrap px-5 py-3.5 ${changed ? "font-medium text-ink" : "text-muted"}`}>
                        {row.show(h.answers[row.key])}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-line align-top">
                <th scope="row" className="px-5 py-3.5 font-normal text-ink-soft">
                  What would keep you here
                </th>
                {history.map((h) => (
                  <td key={h.quarter} className="px-5 py-3.5 text-muted">
                    {h.keepMe.length ? h.keepMe.map(label).join(", ") : "None picked"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
