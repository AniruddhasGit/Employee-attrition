import type { KeepOption } from "@/lib/api";
import { fmtQuarter } from "./labels";

/** The picks from the latest check-in, in the order they were chosen. */
export function KeepMe({
  keepMe,
  comment,
  options,
  quarter,
}: {
  keepMe: string[];
  comment: string | null;
  options: KeepOption[];
  quarter: string | null;
}) {
  const label = (key: string) => options.find((o) => o.key === key)?.label ?? key;
  return (
    <section aria-labelledby="keep-title" className="flex flex-col rounded-2xl border border-line bg-surface p-6 md:p-8">
      <h2 id="keep-title" className="text-xl font-semibold tracking-[-0.01em]">
        What would keep you here
      </h2>
      <p className="mt-1 text-sm text-muted">
        {quarter ? `From your ${fmtQuarter(quarter)} check-in.` : "The last step of each check-in asks this."}
      </p>
      {keepMe.length > 0 ? (
        <ol className="mt-6 flex flex-col">
          {keepMe.map((k, i) => (
            <li key={k} className="flex items-baseline gap-4 border-t border-line py-4 first:border-t-0 first:pt-0">
              <span className="font-mono text-xs tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-lg font-medium">{label(k)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-ink-soft">Nothing picked yet.</p>
      )}
      {comment && (
        <blockquote className="mt-8 border-l-2 border-calm pl-4 leading-relaxed text-ink-soft">
          <p>{comment}</p>
        </blockquote>
      )}
    </section>
  );
}
