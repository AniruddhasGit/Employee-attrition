import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { SITE } from "@/lib/site";
import { Logo } from "./Logo";

export function Nav() {
  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Logo />
          {SITE.name}
        </Link>
        <ul className="hidden items-center gap-8 text-sm md:flex">
          {SITE.nav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="text-ink-soft hover:text-ink">
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/#contact" className="text-ink-soft hover:text-ink">
              Get in touch
            </Link>
          </li>
        </ul>
        <Link
          href="/login"
          className="group inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Sign in
          <ArrowRightIcon size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </nav>
    </header>
  );
}
