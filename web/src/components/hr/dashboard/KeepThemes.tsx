"use client";

import { LockSimpleIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type { KeepTheme } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { Reveal } from "@/components/ui/Reveal";

/** Each department's top three answers to "what would keep you here", as share of people who answered. */
export function KeepThemes({ themes, minGroup = 5 }: { themes: KeepTheme[]; minGroup?: number }) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {themes.map((t, i) => (
        <Reveal as="li" key={t.department} delay={i * 0.06} y={16} className="flex flex-col rounded-2xl border border-line bg-surface p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
            <h3 className="font-medium">{t.department}</h3>
            <span className="tabular shrink-0 rounded-full bg-bg px-2.5 py-0.5 text-xs text-muted ring-1 ring-line">{int(t.n)} answered</span>
          </div>
          {t.hidden ? (
            <p className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-muted">
              <LockSimpleIcon size={16} className="mt-0.5 shrink-0" aria-hidden />
              Fewer than {minGroup} answers this quarter, so this team&apos;s themes stay hidden to keep them anonymous.
            </p>
          ) : t.top.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No themes picked yet.</p>
          ) : (
            <ol className="mt-6 flex flex-col gap-4">
              {t.top.map((k, j) => (
                <li key={k.key}>
                  <p className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="flex min-w-0 items-baseline gap-2.5">
                      <span className="tabular w-3 shrink-0 font-mono text-xs text-muted">{j + 1}</span>
                      <span className={j === 0 ? "font-medium" : "text-ink-soft"}>{k.label}</span>
                    </span>
                    <span className={`tabular shrink-0 ${j === 0 ? "font-semibold text-ink" : "text-muted"}`}>{pct(k.share)}</span>
                  </p>
                  <span className="relative ml-[22px] mt-2 block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                    <motion.span
                      className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-calm"
                      style={{ opacity: 1 - j * 0.25 }}
                      initial={{ transform: reduce ? `scaleX(${k.share})` : "scaleX(0)" }}
                      whileInView={{ transform: `scaleX(${k.share})` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: 0.15 + j * 0.06, ease: EASE_OUT }}
                    />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Reveal>
      ))}
    </ul>
  );
}
