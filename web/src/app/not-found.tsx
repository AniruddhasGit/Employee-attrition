import Link from "next/link";
import { Logo } from "@/components/site/Logo";
import { PillButton } from "@/components/ui/PillButton";
import { SITE } from "@/lib/site";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Quiet backdrop: the logo's open ring, very large, off to the side. */}
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute -bottom-[18vw] -right-[38vw] w-[min(100vw,760px)] text-line md:-right-[6vw] md:bottom-auto md:top-1/2 md:-translate-y-1/2 lg:right-[2vw]"
      >
        <circle cx="9" cy="10" r="6.25" fill="none" stroke="currentColor" strokeWidth="0.12" strokeDasharray="30 9.3" />
        <circle cx="15.2" cy="4.6" r="0.3" fill="var(--mist)" />
      </svg>

      <header className="relative mx-auto flex h-16 w-full max-w-[1400px] items-center px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2 py-2 text-[15px] font-semibold tracking-tight">
          <Logo />
          {SITE.name}
        </Link>
      </header>

      <main id="main" className="relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-4 pb-20 md:px-8">
        <p className="tabular inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 font-mono text-xs text-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-mist" />
          Error 404
        </p>
        <h1 className="mt-6 max-w-[11ch] text-[clamp(3rem,9vw,7.5rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-balance">
          This page left the team.
        </h1>
        <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-pretty text-muted">
          The address doesn&apos;t match anything in {SITE.name}. It may have moved, or the link may be mistyped.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <PillButton href="/" variant="dark">
            Back to the start
          </PillButton>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
