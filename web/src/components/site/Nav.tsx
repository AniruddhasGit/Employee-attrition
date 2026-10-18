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
              <Link href={item.href} className="group inline-flex items-center gap-1.5 text-ink-soft hover:text-ink">
                {item.label}
                <ArrowRightIcon size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/#contact" className="group inline-flex items-center gap-1.5 text-sm font-medium">
          Get in touch
          <ArrowRightIcon size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </nav>
      <ul className="flex items-center gap-6 px-4 text-sm md:hidden">
        {SITE.nav.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-ink-soft">{item.label}</Link>
          </li>
        ))}
      </ul>
    </header>
  );
}
