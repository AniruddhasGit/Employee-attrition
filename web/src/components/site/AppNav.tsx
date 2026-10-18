"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { signOut } from "@/lib/api";
import { useSession } from "@/lib/session";
import { SITE } from "@/lib/site";
import { Logo } from "./Logo";

const LINKS = {
  hr: [
    { href: "/hr", label: "Dashboard" },
    { href: "/hr/check-ins", label: "Check-ins" },
  ],
  employee: [
    { href: "/me", label: "Home" },
    { href: "/me/check-in", label: "Check-in" },
  ],
} as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Header for the signed-in areas: where you can go, who you are, and a way out. */
export function AppNav() {
  const state = useSession();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const session = state.status === "signed-in" ? state.session : null;
  const links = session ? LINKS[session.role] : [];

  async function onSignOut() {
    setLeaving(true);
    await signOut().catch(() => undefined);
    // A full page load, not a client transition: nothing from this account's pages
    // (kept alive by Next's back/forward cache) may survive into the next sign-in.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load is the point
    window.location.assign("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-4 sm:gap-6 md:px-8">
        <Link
          href={session?.home ?? "/"}
          aria-label={`${SITE.name} home`}
          className="flex items-center gap-2 py-2 pr-1 text-[15px] font-semibold tracking-tight"
        >
          <Logo />
          <span className="hidden min-[400px]:inline">{SITE.name}</span>
        </Link>

        <ul className="flex items-center gap-0.5 rounded-full border border-line bg-surface/60 p-1 text-sm">
          {links.map((l) => {
            const home = l.href === "/hr" || l.href === "/me";
            const active = home ? pathname === l.href || (l.href === "/hr" && pathname.startsWith("/hr/people")) : pathname.startsWith(l.href);
            return (
              <li key={l.href} className="relative">
                {active && (
                  <motion.span
                    layoutId="app-nav-active"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.35, bounce: 0.12 }}
                  />
                )}
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative block whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition-colors duration-200 ${
                    active ? "text-bg" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-2 text-sm sm:gap-3">
          {session && (
            <span className="hidden items-center gap-2.5 sm:inline-flex">
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-full bg-[radial-gradient(120%_120%_at_30%_20%,var(--hero-c),var(--hero-b))] text-[11px] font-semibold tracking-wide text-ink ring-1 ring-line"
              >
                {initials(session.displayName)}
              </span>
              <span className="max-w-[16ch] truncate text-ink-soft">{session.displayName}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onSignOut}
            disabled={leaving}
            aria-label="Sign out"
            className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3 transition-transform duration-150 ease-out hover:bg-surface active:scale-[0.97] disabled:opacity-60 sm:px-3.5"
          >
            <SignOutIcon size={15} /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
