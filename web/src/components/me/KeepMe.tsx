import { QuotesIcon } from "@phosphor-icons/react/dist/ssr";
import type { KeepOption } from "@/lib/api";
import { KeepIcon } from "./keepIcons";
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
      <h2 id="keep-title" className="text-xl font-semibold tracking-[-0.015em]">
        What would keep you here
      </h2>
      <p className="mt-1 text-sm text-muted">
        {quarter ? `From your ${fmtQuarter(quarter)} check-in.` : "The last step of each check-in asks this."}
      </p>
      {keepMe.length > 0 ? (
        <ol className="mt-6 flex flex-col gap-2">
          {keepMe.map((k, i) => (
            <li key={k} className="flex items-center gap-4 rounded-xl bg-bg/70 px-4 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-bg">
                <KeepIcon k={k} size={17} />
              </span>
              <span className="text-lg font-medium leading-tight tracking-[-0.01em]">{label(k)}</span>
              <span className="ml-auto font-mono text-xs tabular-nums text-mist">{String(i + 1).padStart(2, "0")}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-line px-5 py-6 text-sm leading-relaxed text-ink-soft">
          Nothing picked yet. Your next check-in ends with this question.
        </div>
      )}
      {comment && (
        <figure className="mt-6 flex gap-3 border-t border-line pt-6">
          <QuotesIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-calm" aria-hidden />
          <blockquote className="leading-relaxed text-ink-soft">
            <p>{comment}</p>
          </blockquote>
        </figure>
      )}
    </section>
  );
}
