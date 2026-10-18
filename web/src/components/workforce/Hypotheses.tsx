"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { getHypotheses } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";
import { useApi } from "@/lib/useApi";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";

export function Hypotheses() {
  const { data, error, retry } = useApi(getHypotheses);
  const [open, setOpen] = useState<string | null>("OverTime");
  const reduce = useReducedMotion();

  if (error) return <ErrorState message={error.message} status={error.status} onRetry={retry} />;
  if (!data) return <Skeleton className="h-80" />;

  return (
    <ul className="border-t border-line">
      {Object.entries(data).map(([key, h]) => {
        const isOpen = open === key;
        return (
          <li key={key} className="border-b border-line">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : key)}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="text-lg font-medium">{h.title}</span>
              <PlusIcon size={18} className={`shrink-0 transition-transform duration-200 ease-out ${isOpen ? "rotate-45" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.25, ease: EASE_OUT }}
                  className="overflow-hidden"
                >
                  <p className="max-w-[62ch] pb-6 leading-relaxed text-muted">{h.body}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
