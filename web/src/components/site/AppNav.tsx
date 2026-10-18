"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SignOutIcon } from "@phosphor-icons/react";
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

/** Header for the signed-in areas: where you can go, who you are, and a way out. */
export function AppNav() {
  const state = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const session = state.status === "signed-in" ? state.session : null;
  const links = session ? LINKS[session.role] : [];

  async function onSignOut() {
    await signOut().catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-4 md:px-8">
        <Link href={session?.home ?? "/"} className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Logo />
          {SITE.name}
        </Link>
        <ul className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const home = l.href === "/hr" || l.href === "/me";
            const active = home ? pathname === l.href || (l.href === "/hr" && pathname.startsWith("/hr/people")) : pathname.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 transition-colors duration-150 ${active ? "bg-ink text-bg" : "text-ink-soft hover:bg-surface hover:text-ink"}`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {session && <span className="hidden text-muted sm:inline">{session.displayName}</span>}
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 transition-transform duration-150 ease-out hover:bg-surface active:scale-[0.97]"
          >
            <SignOutIcon size={14} /> Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}
