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
    { value: pct(trust.rocAuc), meter: trust.rocAuc, label: "Ranking", body: `Given one leaver and one stayer, it scores the leaver higher ${pct(trust.rocAuc)} of the time.` },
    { value: pct(trust.recall), meter: trust.recall, label: "Leavers caught", body: "Share of people who actually left that it flagged." },
    { value: pct(trust.precision), meter: trust.precision, label: "Flags that were right", body: "Share of flagged people who actually left." },
    { value: int(trust.nTest), meter: null, label: "People held out", body: `Kept out of training. Every figure here comes from them. Flagged above ${pct(trust.threshold)}.` },
  ];

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {figures.map((f, i) => (
          <Reveal key={f.label} delay={i * 0.05} y={12} className="flex flex-col rounded-2xl border border-line bg-surface p-4 sm:p-5 md:p-6">
            <dt className="text-[13px] text-muted sm:text-sm">{f.label}</dt>
            <dd className="tabular mt-3 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-none tracking-[-0.03em]">{f.value}</dd>
            <dd className="mt-4" aria-hidden>
              {f.meter === null ? (
                // Where the flag line sits on the 0-100% score scale; scores past it are flagged.
                <span className="relative block h-1 rounded-full bg-line">
                  <motion.span
                    className="absolute inset-y-0 right-0 origin-right rounded-r-full bg-signal/35"
                    style={{ left: `${trust.threshold * 100}%` }}
                    initial={{ transform: reduce ? "scaleX(1)" : "scaleX(0)" }}
                    whileInView={{ transform: "scaleX(1)" }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease: EASE_OUT }}
                  />
                  <span className="absolute -top-1 h-3 w-0.5 -translate-x-1/2 rounded-full bg-signal" style={{ left: `${trust.threshold * 100}%` }} />
                </span>
              ) : (
                <span className="relative block h-1 overflow-hidden rounded-full bg-line">
                  <motion.span
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-series-1"
                    initial={{ transform: reduce ? `scaleX(${f.meter})` : "scaleX(0)" }}
                    whileInView={{ transform: `scaleX(${f.meter})` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease: EASE_OUT }}
                  />
                </span>
              )}
            </dd>
            <dd className="mt-4 text-pretty text-xs leading-relaxed text-muted sm:text-sm">{f.body}</dd>
          </Reveal>
        ))}
      </dl>

      <div className="mt-3 rounded-2xl border border-line bg-surface">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="fairness-detail"
          className="group flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl p-5 text-left transition-transform duration-150 ease-out active:scale-[0.99] md:p-6"
        >
          <span>
            <span className="block font-medium">Is it fair across groups?</span>
            <span className="mt-1 block text-sm text-muted">Leavers caught by gender, age and marital status. Small groups are marked.</span>
          </span>
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line transition-[background-color,color,border-color] duration-150 ease-out group-hover:border-ink group-hover:bg-ink group-hover:text-bg">
            <CaretDownIcon size={16} className={`transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`} aria-hidden />
          </span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="fairness-detail"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.26, ease: EASE_OUT }}
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
