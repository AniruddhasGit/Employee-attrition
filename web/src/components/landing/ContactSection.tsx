"use client";

import { ArrowUpRightIcon, CheckCircleIcon, CircleNotchIcon, EnvelopeSimpleIcon, FileTextIcon, GithubLogoIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, type FormEvent } from "react";
import { ApiError, sendContact } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";
import { SITE } from "@/lib/site";
import { ArrowCircle } from "@/components/ui/ArrowCircle";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { Reveal } from "@/components/ui/Reveal";

type Status = "idle" | "sending" | "sent" | "error";

const field =
  "peer w-full border-0 border-b border-line bg-transparent px-0 py-2.5 text-base text-ink outline-none placeholder:text-mist";

/** Underline that draws in from the left while its sibling input has focus. */
function FocusLine() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-ink transition-transform duration-300 ease-out peer-focus:scale-x-100"
    />
  );
}

const DIRECT = [
  { label: "Email directly", detail: SITE.email.replace("mailto:", ""), href: SITE.email, Icon: EnvelopeSimpleIcon },
  { label: "Read the model card", detail: "Method, metrics and limits", href: `${SITE.repo}/blob/main/docs/MODEL_CARD.md`, Icon: FileTextIcon },
  { label: "Browse the source", detail: "GitHub", href: SITE.repo, Icon: GithubLogoIcon },
];

export function ContactSection() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const reduce = useReducedMotion();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("sending");
    try {
      await sendContact({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        message: String(form.get("message") ?? ""),
        consent: form.get("consent") === "on",
        website: String(form.get("website") ?? ""),
      });
      setStatus("sent");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 422
          ? "Please check the fields: a valid email and a message of at least 10 characters."
          : err instanceof ApiError
            ? err.message
            : "Something went wrong.",
      );
      setStatus("error");
    }
  }

  return (
    <section id="contact" aria-labelledby="contact-title" className="bg-surface">
      <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-y-12 px-4 py-24 md:px-8 md:py-32">
        <div className="col-span-12 md:col-span-5">
          <p className="mb-6 flex items-center gap-2 text-sm text-muted md:mb-8">
            <span aria-hidden className="h-px w-6 bg-mist" />
            Contact
          </p>
          <Reveal>
            <h2 id="contact-title" className="text-[clamp(2.25rem,4.4vw,4rem)] font-semibold leading-[1] tracking-[-0.035em]">
              Have a question about the model?
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-[38ch] leading-relaxed text-pretty text-muted">
              Questions about the method, the data, or using this approach on your own team. I read
              every message.
            </p>
          </Reveal>
          <Stagger as="ul" delay={0.1} className="mt-10 flex flex-col border-t border-line">
            {DIRECT.map(({ label, detail, href, Icon }) => (
              <StaggerItem as="li" key={label} className="border-b border-line">
                <a
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="group flex items-center gap-4 py-4"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-bg text-ink-soft transition-[color,border-color,transform] duration-200 ease-out group-hover:border-ink/25 group-hover:text-ink group-active:scale-[0.96]">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block truncate text-sm text-muted">{detail}</span>
                  </span>
                  <ArrowUpRightIcon size={16} className="shrink-0 text-muted transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div data-testid="contact-form" className="col-span-12 md:col-span-6 md:col-start-7 md:pt-2">
          <AnimatePresence mode="wait" initial={false}>
            {status === "sent" ? (
              <motion.div
                key="sent"
                role="status"
                initial={{ opacity: 0, transform: reduce ? "none" : "translateY(8px)" }}
                animate={{ opacity: 1, transform: reduce ? "none" : "translateY(0px)" }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="flex flex-col items-start gap-4 border-t border-line pt-8"
              >
                <motion.span
                  initial={{ opacity: 0, transform: reduce ? "none" : "scale(0.8)" }}
                  animate={{ opacity: 1, transform: reduce ? "none" : "scale(1)" }}
                  transition={{ type: "spring", duration: 0.45, bounce: 0.3, delay: 0.05 }}
                  className="grid size-12 place-items-center rounded-full bg-bg ring-1 ring-line"
                >
                  <CheckCircleIcon size={26} className="text-calm" weight="fill" />
                </motion.span>
                <p className="text-2xl font-medium">Thanks. Message received.</p>
                <p className="text-muted">You&apos;ll hear back by email.</p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={onSubmit}
                exit={{ opacity: 0, transform: reduce ? "none" : "translateY(-8px)" }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="grid grid-cols-1 gap-8 rounded-2xl border border-line bg-bg/60 p-5 sm:p-8 md:grid-cols-2"
                noValidate={false}
              >
                <div className="flex flex-col gap-2">
                  <label htmlFor="c-name" className="text-sm font-medium">Name</label>
                  <div className="relative">
                    <input id="c-name" name="name" required maxLength={80} autoComplete="name" placeholder="Your name" className={field} />
                    <FocusLine />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="c-email" className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <input id="c-email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" className={field} />
                    <FocusLine />
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label htmlFor="c-message" className="text-sm font-medium">Message</label>
                  <div className="relative">
                    <textarea id="c-message" name="message" required minLength={10} maxLength={2000} rows={4} placeholder="What would you like to know?" className={`${field} block resize-none`} />
                    <FocusLine />
                  </div>
                  <p className="text-xs text-muted">At least 10 characters.</p>
                </div>
                {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
                <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="c-website">Website</label>
                  <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
                </div>
                <label className="flex items-start gap-3 text-sm text-ink-soft md:col-span-2">
                  <input name="consent" type="checkbox" required className="mt-0.5 size-4 accent-[var(--ink)]" />
                  I agree to my name, email and message being stored so I can get a reply.
                </label>
                <div className="flex flex-wrap items-center gap-4 md:col-span-2">
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="group inline-flex h-11 items-center gap-3 rounded-full bg-ink pl-5 pr-1.5 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-70"
                  >
                    {status === "sending" ? "Sending" : "Send message"}
                    {status === "sending" ? (
                      <span aria-hidden className="grid size-7 place-items-center rounded-full bg-bg text-ink">
                        <CircleNotchIcon size={14} weight="bold" className="animate-spin" />
                      </span>
                    ) : (
                      <ArrowCircle inverted />
                    )}
                  </button>
                  <AnimatePresence initial={false}>
                    {status === "error" && (
                      <motion.p
                        role="alert"
                        initial={{ opacity: 0, transform: reduce ? "none" : "translateX(-4px)" }}
                        animate={{ opacity: 1, transform: "translateX(0px)" }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.2, ease: EASE_OUT }}
                        className="flex items-start gap-2 text-sm text-ink-soft"
                      >
                        <WarningCircleIcon size={16} className="mt-0.5 shrink-0 text-signal" />
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
