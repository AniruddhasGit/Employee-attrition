"use client";

import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/motion";
import { SITE } from "@/lib/site";

const LINKS = [
  { label: "GitHub", href: SITE.repo },
  { label: "Model card", href: `${SITE.repo}/blob/main/docs/MODEL_CARD.md` },
  { label: "Email", href: SITE.email },
];

export function Footer() {
  const reduce = useReducedMotion();
  const words = ["Get", "in", "touch"];

  return (
    <footer className="p-2">
      <div className="overflow-hidden rounded-2xl bg-night px-4 pb-6 pt-14 text-night-ink md:px-8 md:pt-20">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid grid-cols-12 gap-y-8">
            <p className="col-span-12 max-w-[18ch] text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] md:col-span-6">
              Let&apos;s keep your people.
            </p>
            <p className="col-span-12 max-w-[40ch] text-sm leading-relaxed text-night-ink/70 md:col-span-4 md:col-start-9 md:self-end">
              Built on fictional IBM HR data to show a method: honest testing, plain explanations,
              and a model that admits what it can&apos;t do.
            </p>
          </div>

          <ul className="mt-14 flex flex-wrap gap-x-10 gap-y-4 border-t border-night-ink/15 pt-6">
            {LINKS.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="group inline-flex items-center gap-2 text-sm" target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                  {l.label}
                  <ArrowUpRightIcon size={14} className="transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </li>
            ))}
          </ul>

          <a href={SITE.email} className="mt-10 block">
            {/* The visible parent is observed; words start clipped below their masks. */}
            <motion.span
              initial="hidden"
              whileInView="shown"
              viewport={{ once: true, amount: 0.4 }}
              className="flex flex-wrap gap-x-[0.22em] text-[clamp(3.5rem,13.5vw,13rem)] font-semibold leading-[0.85] tracking-[-0.055em]"
            >
              {words.map((w, i) => (
                <span key={w} className="inline-block overflow-hidden pb-[0.05em]">
                  <motion.span
                    className="inline-block"
                    variants={{
                      hidden: reduce ? { opacity: 0 } : { transform: "translateY(100%)" },
                      shown: reduce ? { opacity: 1 } : { transform: "translateY(0%)" },
                    }}
                    transition={{ duration: 0.9, delay: i * 0.08, ease: EASE_OUT }}
                  >
                    {w}
                  </motion.span>
                  {/* Real spaces keep the link's accessible name "Get in touch", not "Getintouch". */}
                  {i < words.length - 1 && <span className="sr-only"> </span>}
                </span>
              ))}
            </motion.span>
          </a>

          <div className="mt-8 flex flex-wrap justify-between gap-2 text-xs text-night-ink/60">
            <p>© 2026 {SITE.author}</p>
            <p>{SITE.disclaimer}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
