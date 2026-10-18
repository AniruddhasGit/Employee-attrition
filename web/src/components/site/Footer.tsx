"use client";

import Link from "next/link";
import { ArrowUpIcon, ArrowUpRightIcon, DatabaseIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/motion";
import { SITE } from "@/lib/site";
import { Logo } from "./Logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Insights", href: "/#questions" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "GitHub", href: SITE.repo },
      { label: "Model card", href: `${SITE.repo}/blob/main/docs/MODEL_CARD.md` },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "Email", href: SITE.email },
      { label: "Send a message", href: "/#contact" },
    ],
  },
];

function FooterLink({ label, href }: { label: string; href: string }) {
  const external = href.startsWith("http") || href.startsWith("mailto:");
  const cls = "group inline-flex items-center gap-1.5 py-1 text-sm text-night-ink/80 transition-colors duration-150 hover:text-night-ink";
  const inner = (
    <>
      <span className="link-underline">{label}</span>
      {external && (
        <ArrowUpRightIcon size={12} className="opacity-60 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      )}
    </>
  );
  return external ? (
    <a href={href} className={cls} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

export function Footer() {
  const reduce = useReducedMotion();
  const words = ["Get", "in", "touch"];

  return (
    <footer className="p-2">
      <div className="relative overflow-hidden rounded-2xl bg-night px-4 pb-6 pt-14 text-night-ink md:px-8 md:pt-20">
        {/* Soft light in the corner so the dark panel has depth, not a flat slab. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(143_176_204/0.16),transparent)]"
        />
        <div className="relative mx-auto max-w-[1400px]">
          <div className="grid grid-cols-12 gap-y-12">
            <div className="col-span-12 md:col-span-5">
              <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                <Logo />
                {SITE.name}
              </Link>
              <p className="mt-6 max-w-[18ch] text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
                Let&apos;s keep your people.
              </p>
              <p className="mt-5 max-w-[40ch] text-sm leading-relaxed text-night-ink/70">
                Honest testing, plain explanations, and a model that admits what it can&apos;t do.
              </p>
            </div>

            <nav aria-label="Footer" className="col-span-12 grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-6 md:col-start-7">
              {COLUMNS.map((col) => (
                <div key={col.title}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-night-ink/50">{col.title}</p>
                  <ul className="mt-4 flex flex-col gap-1.5">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        <FooterLink {...l} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <a href={SITE.email} className="mt-16 block border-t border-night-ink/15 pt-8 md:mt-20">
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

          <div className="mt-10 flex flex-col gap-4 border-t border-night-ink/15 pt-6 text-xs text-night-ink/60 md:flex-row md:items-center md:justify-between">
            <p className="flex items-center gap-2">
              <DatabaseIcon size={14} aria-hidden className="shrink-0" />
              {SITE.dataNote}
            </p>
            <div className="flex items-center justify-between gap-6">
              <p>© 2026 {SITE.author}</p>
              <a
                href="#main"
                aria-label="Back to top"
                className="grid size-10 place-items-center rounded-full border border-night-ink/20 text-night-ink transition-transform duration-150 ease-out hover:border-night-ink/40 active:scale-[0.97]"
              >
                <ArrowUpIcon size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
