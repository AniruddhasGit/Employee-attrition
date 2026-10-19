"use client";

import { CheckIcon, CopyIcon, PlusIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { AddedPerson } from "@/lib/api";
import { pct } from "@/lib/format";
import { EASE_OUT, SPRING } from "@/lib/motion";
import { CountUp, Stagger, StaggerItem } from "@/components/ui/motion";
import { firstName } from "@/lib/onboard";
import { PillButton } from "@/components/ui/PillButton";
import { BandChip } from "../BandChip";

/** The sign-in details to hand over, with one-tap copy. */
function Credentials({ email, password }: { email: string; password: string }) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2400);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Email: ${email}\nTemporary password: ${password}`);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="rounded-xl border border-line bg-bg">
      <dl className="divide-y divide-line text-sm">
        <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <dt className="text-muted">Email</dt>
          <dd className="min-w-0 break-all font-medium">{email}</dd>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <dt className="text-muted">Temporary password</dt>
          <dd data-testid="temp-password" className="min-w-0 break-all font-mono text-base tracking-wide">
            {password}
          </dd>
        </div>
      </dl>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
        <p aria-live="polite" className="text-sm text-muted">
          <AnimatePresence mode="wait" initial={false}>
            {copied && (
              <motion.span
                key={copied}
                initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : 4}px)` }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="inline-block"
              >
                {copied === "ok" ? "Copied both." : "Couldn't copy. Select the text instead."}
              </motion.span>
            )}
          </AnimatePresence>
        </p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-medium transition-[border-color,transform] duration-150 ease-out hover:border-ink/30 active:scale-[0.97]"
        >
          {copied === "ok" ? <CheckIcon size={14} weight="bold" aria-hidden /> : <CopyIcon size={14} aria-hidden />}
          Copy details
        </button>
      </div>
    </div>
  );
}

/** After adding: what to hand over, where they start, and where to go next. */
export function Added({ person, password, onAnother }: { person: AddedPerson; password: string; onAnother: () => void }) {
  const reduce = useReducedMotion();
  const first = firstName(person.name);
  return (
    <section
      data-testid="added"
      aria-labelledby="added-title"
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6 md:p-10"
    >
      <Stagger onMount gap={0.07} delay={0.12}>
      <StaggerItem>
      <p className="flex items-center gap-2.5 text-sm text-muted">
        {/* The check pops in on a spring and sends out one soft ring: done, and it worked. */}
        <span aria-hidden className="relative grid size-6 place-items-center">
          {!reduce && (
            <motion.span
              className="absolute inset-0 rounded-full border border-ink"
              initial={{ opacity: 0.5, scale: 1 }}
              animate={{ opacity: 0, scale: 2.2 }}
              transition={{ duration: 0.8, delay: 0.3, ease: EASE_OUT }}
            />
          )}
          <motion.span
            className="grid size-6 place-items-center rounded-full bg-ink text-bg"
            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING.snappy, delay: 0.15 }}
          >
            <CheckIcon size={12} weight="bold" />
          </motion.span>
        </span>
        Added and scored
      </p>
      </StaggerItem>
      <StaggerItem>
      <h2
        id="added-title"
        className="mt-5 text-balance text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1] tracking-[-0.04em]"
      >
        {person.name} is in.
      </h2>
      <p className="mt-4 max-w-[52ch] text-pretty leading-relaxed text-muted">
        Share these with {first}. They&apos;ll choose their own password on first sign-in.
      </p>
      </StaggerItem>

      <StaggerItem className="mt-8">
        <Credentials email={person.email} password={password} />
      </StaggerItem>

      <StaggerItem>

      <div className="mt-8 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">Starting risk</p>
          <p className="mt-2 flex items-center gap-3">
            <CountUp
              testId="added-score"
              value={person.riskScore}
              format={(v) => pct(v)}
              duration={0.9}
              className="text-4xl font-semibold tracking-[-0.03em]"
            />
            <BandChip band={person.riskBand} />
          </p>
        </div>
        <p className="max-w-[36ch] text-sm leading-relaxed text-muted sm:text-right">
          From colleagues in the same role. It sharpens once {first} answers a check-in.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <PillButton href={`/hr/people/${person.id}`} variant="dark">
          Open {first}&apos;s page
        </PillButton>
        <button
          type="button"
          onClick={onAnother}
          className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-5 text-sm font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-bg active:scale-[0.97]"
        >
          <PlusIcon size={14} aria-hidden />
          Add another
        </button>
      </div>
      </StaggerItem>
      </Stagger>
    </section>
  );
}
