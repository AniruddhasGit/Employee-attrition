"use client";

import Link from "next/link";
import { ArrowRightIcon, ListIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { EASE_OUT } from "@/lib/motion";
import { SITE } from "@/lib/site";
import { Logo } from "./Logo";

/**
 * Public header. Transparent over the hero; once the page scrolls it gains a frosted bar,
 * tucks away while reading down and comes back on the first scroll up.
 */
export function Nav() {
  const { scrollY } = useScroll();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const delta = y - (scrollY.getPrevious() ?? 0);
    setScrolled(y > 24);
    // Direction with a dead zone: the slow tail of a smooth scroll must not flip it back.
    if (y < 480 || open) setHidden(false);
    else if (delta > 3) setHidden(true);
    else if (delta < -3) setHidden(false);
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            key="scrim"
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="fixed inset-0 z-30 cursor-default bg-ink/20 backdrop-blur-[2px] md:hidden"
          />
        )}
      </AnimatePresence>
      <header
        className="fixed inset-x-0 top-0 z-40 transition-transform duration-300 ease-out"
        style={{ transform: hidden && !reduce ? "translateY(-110%)" : "translateY(0)" }}
      >
        <div
          className={`transition-[background-color,border-color,box-shadow] duration-300 ${
            solid ? "border-b border-line bg-bg/80 backdrop-blur-xl" : "border-b border-transparent"
          }`}
        >
          <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 md:px-8">
            <Link href="/" className="flex items-center gap-2 py-2 text-[15px] font-semibold tracking-tight" aria-label={`${SITE.name} home`}>
              <Logo />
              {SITE.name}
            </Link>

            <ul className="hidden items-center gap-1 text-sm md:flex">
              {SITE.nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-full px-3.5 py-2 text-ink-soft transition-colors duration-150 hover:bg-surface hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                Sign in
                <ArrowRightIcon size={13} weight="bold" className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
              </Link>
              <button
                type="button"
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                aria-controls="site-menu"
                onClick={() => setOpen((o) => !o)}
                className="grid size-10 place-items-center rounded-full border border-line bg-surface/70 transition-transform duration-150 ease-out active:scale-[0.97] md:hidden"
              >
                {open ? <XIcon size={16} /> : <ListIcon size={16} />}
              </button>
            </div>
          </nav>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id="site-menu"
                key="menu"
                initial={{ opacity: 0, transform: "translateY(-6px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transform: "translateY(-4px)", transition: { duration: 0.12 } }}
                transition={{ duration: 0.22, ease: EASE_OUT }}
                className="md:hidden"
              >
                <ul className="mx-auto flex max-w-[1400px] flex-col px-4 pb-5">
                  {SITE.nav.map((item, i) => (
                    <motion.li
                      key={item.href}
                      initial={{ opacity: 0, transform: "translateY(6px)" }}
                      animate={{ opacity: 1, transform: "translateY(0px)" }}
                      transition={{ duration: 0.22, delay: 0.04 * i, ease: EASE_OUT }}
                      className="border-b border-line last:border-0"
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between py-3.5 text-lg font-medium tracking-tight"
                      >
                        {item.label}
                        <ArrowRightIcon size={16} className="text-muted" />
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
    </>
  );
}
