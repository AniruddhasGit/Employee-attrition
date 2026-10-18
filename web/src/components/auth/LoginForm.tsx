"use client";

import { ArrowRightIcon, CircleNotchIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import { ApiError, getDemoAccounts, signIn, type DemoAccount, type Session } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";
import { useSession } from "@/lib/session";
import { DEMO_PASSWORD } from "@/lib/site";

function destination(session: Session, next: string | null): string {
  // Only follow ?next= inside the area this account may use.
  return next && next.startsWith(session.home) ? next : session.home;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const state = useSession();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<DemoAccount[] | null>(null);

  useEffect(() => {
    if (state.status === "signed-in") router.replace(destination(state.session, next));
  }, [state, router, next]);

  // Next keeps this page alive while hidden; clear in-flight state so it never comes back frozen.
  useLayoutEffect(
    () => () => {
      setBusy(null);
      setError(null);
    },
    [],
  );

  useEffect(() => {
    getDemoAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  async function submit(addr: string, pass: string, who: string) {
    setBusy(who);
    setError(null);
    try {
      const session = await signIn(addr, pass);
      // Full page load into the signed-in area, so no state from an earlier account survives.
       
      window.location.assign(destination(session, next));
    } catch (err) {
      setBusy(null);
      if (err instanceof ApiError && (err.status === 0 || err.status === 502)) {
        setError("Can't reach the server. It sleeps when idle, so the first sign-in can take up to a minute.");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(email, password, "form");
  }

  function asDemo(a: DemoAccount) {
    setEmail(a.email);
    setPassword(DEMO_PASSWORD);
    submit(a.email, DEMO_PASSWORD, a.email);
  }

  const enter = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, transform: "translateY(12px)" },
          animate: { opacity: 1, transform: "translateY(0px)" },
          transition: { duration: 0.5, delay: 0.06 * i, ease: EASE_OUT },
        };

  return (
    <div className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-12 gap-y-12 px-4 pb-16 pt-28 md:px-8 md:pt-36">
      <div className="col-span-12 md:col-span-5">
        <motion.h1 {...enter(0)} className="text-[clamp(3rem,8vw,7rem)] font-semibold leading-[0.9] tracking-[-0.05em]">
          Sign in.
        </motion.h1>
        <motion.p {...enter(1)} className="mt-6 max-w-[38ch] leading-relaxed text-muted">
          HR sees who might leave, why, and what to do about it. Employees answer a short check-in each quarter.
          Your account decides which one you get.
        </motion.p>
      </div>

      <div className="col-span-12 md:col-span-6 md:col-start-7">
        <motion.form {...enter(2)} onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-b border-line bg-transparent pb-2 text-lg outline-none transition-colors duration-150 focus:border-ink"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-b border-line bg-transparent pb-2 text-lg outline-none transition-colors duration-150 focus:border-ink"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-signal">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy !== null || !email || !password}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-50"
          >
            {busy === "form" && <CircleNotchIcon size={14} className="animate-spin" />}
            Sign in
            <ArrowRightIcon size={14} />
          </button>
        </motion.form>

        <motion.section {...enter(3)} aria-labelledby="demo-title" className="mt-14 border-t border-line pt-8">
          <h2 id="demo-title" className="text-sm font-medium">
            Demo accounts
          </h2>
          <p className="mt-1 text-sm text-muted">One click signs you in as that person.</p>
          <ul className="mt-5 flex flex-col">
            {accounts === null &&
              Array.from({ length: 5 }, (_, i) => <li key={i} className="h-12 animate-pulse border-b border-line" />)}
            {accounts?.map((a) => (
              <li key={a.email} className="border-b border-line">
                <button
                  type="button"
                  onClick={() => asDemo(a)}
                  disabled={busy !== null}
                  className="group flex w-full items-center justify-between gap-4 py-3.5 text-left disabled:opacity-60"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${a.role === "hr" ? "bg-ink text-bg" : "bg-surface text-ink-soft ring-1 ring-line"}`}
                    >
                      {a.role === "hr" ? "HR" : "Employee"}
                    </span>
                    <span>Sign in as {a.label}</span>
                  </span>
                  {busy === a.email ? (
                    <CircleNotchIcon size={16} className="animate-spin" />
                  ) : (
                    <ArrowRightIcon size={16} className="transition-transform duration-200 ease-out group-hover:translate-x-1" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-muted">All people and data here are fictional.</p>
        </motion.section>
      </div>
    </div>
  );
}
