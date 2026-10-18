"use client";

import { WarningIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { compareSegments, type Segment, type SegmentStats } from "@/lib/api";
import { int, money, pct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";

const DEPARTMENTS = ["", "Sales", "Research & Development", "Human Resources"];

function Controls({ side, value, onChange }: { side: "A" | "B"; value: Segment; onChange: (s: Segment) => void }) {
  const select = "w-full rounded-full border border-line bg-surface px-3 py-2 text-sm";
  return (
    <div className="grid grid-cols-3 gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Department
        <select className={select} value={value.department ?? ""} onChange={(e) => onChange({ ...value, department: e.target.value || undefined })} aria-label={`Group ${side} department`}>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d || "Any"}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Overtime
        <select className={select} value={value.overTime ?? ""} onChange={(e) => onChange({ ...value, overTime: (e.target.value || undefined) as Segment["overTime"] })} aria-label={`Group ${side} overtime`}>
          <option value="">Any</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Job level
        <select className={select} value={value.jobLevel ?? ""} onChange={(e) => onChange({ ...value, jobLevel: e.target.value ? Number(e.target.value) : undefined })} aria-label={`Group ${side} job level`}>
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
    </div>
  );
}

function Stats({ s, testId, swatch }: { s: SegmentStats; testId: string; swatch: string }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-5">
      <p className="flex items-center gap-2 font-medium">
        <span className="size-2.5 rounded-full" style={{ background: swatch }} />
        {s.label}
      </p>
      <dl className="grid grid-cols-2 gap-4">
        <div><dt className="text-xs text-muted">Size</dt><dd className="tabular text-2xl font-semibold">{int(s.n)} people</dd></div>
        <div><dt className="text-xs text-muted">Actually left</dt><dd className="tabular text-2xl font-semibold">{s.attritionRate === null ? "n/a" : pct(s.attritionRate)}</dd></div>
        <div><dt className="text-xs text-muted">Average risk score</dt><dd className="tabular text-2xl font-semibold">{s.meanRisk === null ? "n/a" : pct(s.meanRisk)}</dd></div>
        <div><dt className="text-xs text-muted">Expected cost</dt><dd className="tabular text-2xl font-semibold">{money(s.expectedCost)}</dd></div>
      </dl>
      {s.topDrivers.length > 0 && (
        <p className="text-sm text-muted">
          Raising risk most often: <span className="text-ink">{s.topDrivers.map((d) => d.text.toLowerCase()).join(", ")}</span>
        </p>
      )}
      {s.smallSample && (
        <p className="flex items-center gap-2 text-sm text-signal">
          <WarningIcon size={16} /> Fewer than 10 people. Treat these numbers as noise.
        </p>
      )}
    </div>
  );
}

export function SegmentCompare() {
  const [a, setA] = useState<Segment>({ overTime: "Yes" });
  const [b, setB] = useState<Segment>({ overTime: "No" });
  const { data, error, retry } = useApi(() => compareSegments(a, b), [a, b]);

  return (
    <div data-testid="segment-compare" className="grid grid-cols-1 gap-10 md:grid-cols-2">
      {(["A", "B"] as const).map((side) => (
        <div key={side} className="flex flex-col gap-8 rounded-2xl border border-line bg-surface p-6">
          <Controls side={side} value={side === "A" ? a : b} onChange={side === "A" ? setA : setB} />
          {data ? (
            <Stats
              s={side === "A" ? data.a : data.b}
              testId={side === "A" ? "segment-a" : "segment-b"}
              swatch={side === "A" ? "var(--series-1)" : "var(--series-3)"}
            />
          ) : error ? (
            <ErrorState message={error.message} onRetry={retry} />
          ) : (
            <Skeleton className="h-56" />
          )}
        </div>
      ))}
    </div>
  );
}
