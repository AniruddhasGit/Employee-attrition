"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Dashboard } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { Reveal } from "@/components/ui/Reveal";
import { FairnessTable } from "../FairnessTable";

/** Held-out accuracy in plain words, with the per-group breakdown one click away. */
export function TrustPanel({ trust }: { trust: Dashboard["trust"] }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const figures = [
    { value: pct(trust.rocAuc), label: "Ranking", body: `Given one leaver and one stayer, it scores the leaver higher ${pct(trust.rocAuc)} of the time.` },
    { value: pct(trust.recall), label: "Leavers caught", body: "Share of people who actually left that it flagged." },
    { value: pct(trust.precision), label: "Flags that were right", body: "Share of flagged people who actually left." },
    { value: int(trust.nTest), label: "People held out", body: `Never seen in training. Every figure here comes from them. Flag line at ${pct(trust.threshold)}.` },
  ];

  return (
    <div>
      <dl className="grid grid-cols-1 border-t border-line sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((f, i) => (
          <Reveal key={f.label} delay={i * 0.05} y={12} className="border-b border-line py-6 sm:pr-6 lg:border-b-0">
            <dt className="text-sm text-muted">{f.label}</dt>
            <dd className="tabular mt-2 text-4xl font-semibold tracking-[-0.03em]">{f.value}</dd>
            <dd className="mt-3 max-w-[32ch] text-sm leading-relaxed text-muted">{f.body}</dd>
          </Reveal>
        ))}
      </dl>

      <div className="mt-8 rounded-2xl border border-line bg-surface">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="fairness-detail"
          className="flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-left md:p-6"
        >
          <span>
            <span className="block font-medium">Is it fair across groups?</span>
            <span className="mt-1 block text-sm text-muted">Leavers caught by gender, age and marital status. Small groups are marked.</span>
          </span>
          <CaretDownIcon size={18} className={`shrink-0 transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="fairness-detail"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.28, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-6 md:px-6">
                <FairnessTable slices={trust.fairness} overallRecall={trust.recall} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
