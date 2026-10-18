"use client";

import { useState } from "react";
import type { Workforce } from "@/lib/api";
import { int, money } from "@/lib/format";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

/**
 * Expected annual cost = sum of (risk score x annual salary x replacement %).
 * Linear in the replacement %, so it rescales instantly from the summary's base value.
 */
export function CostLens({ wf }: { wf: Workforce }) {
  const [replacement, setReplacement] = useState(50);
  const total = (wf.expectedCost * replacement) / wf.replacementPct;

  return (
    <div className="grid grid-cols-12 gap-y-8 md:gap-x-10">
      <div className="col-span-12 md:col-span-7">
        <p className="text-sm text-muted">Expected cost of attrition, next year</p>
        <p data-testid="cost-total" data-value={Math.round(total)} className="mt-2">
          <AnimatedNumber
            value={total}
            format={money}
            className="text-[clamp(3.5rem,9vw,7.5rem)] font-semibold leading-none tracking-[-0.045em]"
          />
        </p>
        <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-muted">
          About {int(wf.expectedLeavers)} expected leavers (the sum of everyone&apos;s risk score), each
          costing {replacement}% of their annual salary to replace.
        </p>
      </div>
      <div className="col-span-12 self-end md:col-span-5">
        <label htmlFor="replacement" className="flex items-baseline justify-between gap-4">
          <span className="font-medium">Replacement cost</span>
          <span className="tabular text-sm text-muted">{replacement}% of salary</span>
        </label>
        <input
          id="replacement"
          type="range"
          min={10}
          max={200}
          step={5}
          value={replacement}
          onChange={(e) => setReplacement(Number(e.target.value))}
          className="mt-3 w-full accent-[var(--ink)]"
        />
        <p className="mt-3 text-xs leading-relaxed text-muted">
          This is an assumption, not a fact. Published estimates range from a fraction of salary
          for entry roles to well over a full year for senior ones. The default is 50%.
        </p>
      </div>
    </div>
  );
}
