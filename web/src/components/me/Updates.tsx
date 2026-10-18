import { ArrowDownRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { TeamNote } from "@/lib/api";
import { fmtQuarter } from "./labels";

/** "You said, we did": what HR changed for this department, newest first. */
export function Updates({ updates, department }: { updates: TeamNote[]; department: string }) {
  return (
    <section aria-labelledby="updates-title" className="rounded-2xl border border-line bg-surface p-6 md:p-8">
      <h2 id="updates-title" className="text-xl font-semibold tracking-[-0.01em]">
        You said, we did
      </h2>
      <p className="mt-1 text-sm text-muted">What HR changed for {department}.</p>
      {updates.length === 0 ? (
        <p className="mt-6 text-ink-soft">Nothing posted for your team yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col">
          {updates.map((u, i) => (
            <li key={i} className="grid gap-3 border-t border-line py-5 first:border-t-0 first:pt-0 sm:grid-cols-[5.5rem_1fr]">
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted sm:pt-1">{fmtQuarter(u.quarter)}</span>
              <div>
                <p className="text-ink-soft">&ldquo;{u.said}&rdquo;</p>
                <p className="mt-2 flex gap-2 font-medium">
                  <ArrowDownRightIcon size={16} weight="bold" className="mt-1 shrink-0 text-calm" aria-hidden />
                  <span>{u.did}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
