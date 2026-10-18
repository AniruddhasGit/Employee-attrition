"use client";

import { CheckCircleIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { ApiError, sendContact } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";
import { ArrowCircle } from "@/components/ui/ArrowCircle";
import { Reveal } from "@/components/ui/Reveal";

type Status = "idle" | "sending" | "sent" | "error";

const field =
  "w-full border-0 border-b border-line bg-transparent px-0 py-2 text-base text-ink outline-none transition-colors duration-200 placeholder:text-muted focus:border-ink";

export function ContactSection() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

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
          <Reveal>
            <h2 id="contact-title" className="text-[clamp(2.25rem,4.4vw,4rem)] font-semibold leading-[1] tracking-[-0.035em]">
              Have a question about the model?
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-[38ch] leading-relaxed text-muted">
              Questions about the method, the data, or using this approach on your own team. I read
              every message.
            </p>
          </Reveal>
        </div>

        <div data-testid="contact-form" className="col-span-12 md:col-span-6 md:col-start-7">
          <AnimatePresence mode="wait" initial={false}>
            {status === "sent" ? (
              <motion.div
                key="sent"
                role="status"
                initial={{ opacity: 0, transform: "translateY(8px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="flex flex-col items-start gap-4 border-t border-line pt-8"
              >
                <CheckCircleIcon size={28} className="text-calm" weight="fill" />
                <p className="text-2xl font-medium">Thanks. Message received.</p>
                <p className="text-muted">You&apos;ll hear back by email.</p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={onSubmit}
                exit={{ opacity: 0, transform: "translateY(-8px)" }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="grid grid-cols-1 gap-8 md:grid-cols-2"
                noValidate={false}
              >
                <div className="flex flex-col gap-2">
                  <label htmlFor="c-name" className="text-sm font-medium">Name</label>
                  <input id="c-name" name="name" required maxLength={80} autoComplete="name" className={field} />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="c-email" className="text-sm font-medium">Email</label>
                  <input id="c-email" name="email" type="email" required autoComplete="email" className={field} />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label htmlFor="c-message" className="text-sm font-medium">Message</label>
                  <textarea id="c-message" name="message" required minLength={10} maxLength={2000} rows={4} className={`${field} resize-none`} />
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
                    className="group inline-flex items-center gap-3 rounded-full bg-ink py-1.5 pl-5 pr-1.5 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
                  >
                    {status === "sending" ? "Sending" : "Send message"}
                    <ArrowCircle inverted />
                  </button>
                  {status === "error" && (
                    <p role="alert" className="text-sm text-signal">{error}</p>
                  )}
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
