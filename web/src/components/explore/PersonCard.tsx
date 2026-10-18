import Link from "next/link";
import type { EmployeeCard } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { BandChip } from "./BandChip";

export function PersonCard({ e }: { e: EmployeeCard }) {
  const raising = e.drivers.filter((d) => d.direction === "raises").slice(0, 2);
  return (
    <Link
      href={`/explore/${e.id}`}
      data-testid="person-card"
      className="group flex h-full flex-col justify-between gap-6 rounded-2xl border border-line bg-surface p-5 transition-[transform,box-shadow] duration-200 ease-out hover:shadow-[0_12px_32px_-18px_rgb(27_36_48/0.45)] [@media(hover:hover)]:hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium leading-snug">{e.jobRole}</p>
          <p className="text-sm text-muted">
            {e.department} · Level {e.jobLevel}
          </p>
        </div>
        <BandChip band={e.riskBand} />
      </div>
      <div>
        <p className="tabular text-5xl font-semibold leading-none tracking-[-0.04em]">{pct(e.riskScore)}</p>
        <p className="mt-1 text-xs text-muted">
          {e.yearsAtCompany} yrs here · ${int(e.monthlyIncome)}/mo
        </p>
      </div>
      <ul className="flex flex-col gap-1 border-t border-line pt-3 text-sm text-ink-soft">
        {raising.length ? (
          raising.map((d) => <li key={d.feature}>{d.text}</li>)
        ) : (
          <li className="text-muted">Nothing strongly raising this score</li>
        )}
      </ul>
    </Link>
  );
}
