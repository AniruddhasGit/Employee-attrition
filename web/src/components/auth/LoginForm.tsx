"use client";

import { ArrowRightIcon, CheckIcon, CircleNotchIcon, EyeIcon, EyeSlashIcon, WarningIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiError, signIn, type Session } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";
import { useSession } from "@/lib/session";
import { WordReveal } from "@/components/ui/motion";
import { CheckInPanel } from "./CheckInPanel";
import { BreathingDot, Collapse, PatientBar, useLabelSwap, usePanelEnter, useRowEnter } from "./motion";
import { field, noRing, underline } from "./fields";

function destination(session: Session, next: string | null): string {
  // A temporary password goes to /welcome first, wherever ?next= points.
  if (session.mustChangePassword) return "/welcome";
  // Only follow ?next= inside the area this account may use.
  return next && next.startsWith(session.home) ? next : session.home;
}

/** How long the "Welcome" state shows before the page changes. */
const WELCOME_MS = 400;
/** A sleeping free-tier server takes about a minute to wake: ask again this often, for this long. */
const WAKE_RETRY_MS = 5_000;
const WAKE_GIVE_UP_MS = 120_000;

/** No answer, or the proxy's "upstream down": the server is asleep, not saying no. */
const asleep = (err: unknown) => err instanceof ApiError && (err.status === 0 || err.status === 502);

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const state = useSession();
  const reduce = useReducedMotion();
  const ids = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const [waking, setWaking] = useState(false);
  // False once the page goes away, so a wake-up retry loop stops instead of signing in behind it.
  const alive = useRef(true);

  useEffect(() => {
    if (state.status === "signed-in" && welcome === null) router.replace(destination(state.session, next));
  }, [state, router, next, welcome]);

  // Next keeps this page alive while hidden; clear in-flight state so it never comes back frozen.
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      setBusy(false);
      setWaking(false);
      setWelcome(null);
      setError(null);
    };
  }, []);

  /** Sign in, quietly asking again while the server wakes up. Null if the page went away meanwhile. */
  async function signInWhenAwake(): Promise<Session | null> {
    const started = Date.now();
    for (;;) {
      try {
        return await signIn(email, password);
      } catch (err) {
        if (!asleep(err) || Date.now() - started + WAKE_RETRY_MS > WAKE_GIVE_UP_MS) throw err;
        setWaking(true);
        await new Promise((r) => window.setTimeout(r, WAKE_RETRY_MS));
        if (!alive.current) return null;
      }
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await signInWhenAwake();
      if (!session || !alive.current) return;
      setWaking(false);
      setWelcome(session.displayName.split(" ")[0] || session.displayName);
      window.setTimeout(() => {
        // Full page load into the signed-in area, so no state from an earlier account survives.
        window.location.assign(destination(session, next));
      }, WELCOME_MS);
    } catch (err) {
      setBusy(false);
      setWaking(false);
      if (asleep(err)) {
        setError("The server still isn't answering. Wait a minute, then sign in again.");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    }
  }

  function readCaps(e: KeyboardEvent<HTMLInputElement>) {
    setCaps(e.getModifierState("CapsLock"));
  }

  const enter = useRowEnter();
  const swap = useLabelSwap();
  const panel = usePanelEnter();

  const locked = busy || welcome !== null;

  return (
    <div className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 gap-10 px-4 pb-16 pt-24 md:px-8 md:pt-28 lg:grid-cols-12 lg:gap-16">
      <motion.div {...panel} className="lg:col-span-7">
        <CheckInPanel />
      </motion.div>

      <div className="flex flex-col justify-center lg:col-span-5 lg:py-10">
        <WordReveal
          text="Sign in."
          delay={0.05}
          className="text-[clamp(3.25rem,8vw,6.5rem)] font-semibold leading-[0.9] tracking-[-0.05em]"
        />
        <motion.p {...enter(1)} className="mt-5 max-w-[40ch] leading-relaxed text-muted">
          HR lands on the people who might leave and what would help. Employees land on their quarterly check-in.
        </motion.p>

        <form onSubmit={onSubmit} className="mt-12 flex flex-col gap-9" noValidate>
          <motion.div {...enter(2)} className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-email`} className="text-sm text-muted">
              Email
            </label>
            <div className="relative">
              <input
                id={`${ids}-email`}
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className={field}
                style={noRing}
              />
              <span aria-hidden className={underline} />
            </div>
          </motion.div>

          <motion.div {...enter(3)} className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-password`} className="text-sm text-muted">
              Password
            </label>
            <div className="relative">
              <input
                id={`${ids}-password`}
                type={shown ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={readCaps}
                onKeyUp={readCaps}
                onBlur={() => setCaps(false)}
                aria-describedby={caps ? `${ids}-caps` : undefined}
                className={`${field} pr-11`}
                style={noRing}
              />
              <span aria-hidden className={underline} />
              <button
                type="button"
                onClick={() => setShown((s) => !s)}
                aria-pressed={shown}
                aria-controls={`${ids}-password`}
                className="absolute bottom-1.5 right-0 grid size-9 place-items-center rounded-full text-muted transition-[color,transform] duration-150 ease-out hover:text-ink active:scale-[0.92]"
              >
                {/* Named by text, not aria-label, so getByLabel("Password") still finds only the input. */}
                <span className="sr-only">{shown ? "Hide password" : "Show password"}</span>
                {shown ? <EyeSlashIcon size={18} aria-hidden /> : <EyeIcon size={18} aria-hidden />}
              </button>
            </div>
            <AnimatePresence initial={false}>
              {caps && (
                <motion.p
                  id={`${ids}-caps`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
                  className="flex items-center gap-1.5 overflow-hidden pt-1 text-sm text-ink-soft"
                >
                  <WarningIcon size={14} aria-hidden />
                  Caps Lock is on.
                </motion.p>
              )}
            </AnimatePresence>
            {/* Inside the field group, so opening it grows its own height instead of popping a flex gap. */}
            <Collapse show={error !== null}>
              <p role="alert" className="mt-4 border-l-2 border-signal pl-3 text-sm leading-relaxed text-signal">
                {error}
              </p>
            </Collapse>
          </motion.div>

          <motion.div {...enter(4)} className="flex flex-col">
            <button
              type="submit"
              disabled={locked || !email || !password}
              className={`group relative inline-flex h-12 w-fit min-w-[9.5rem] items-center justify-center overflow-hidden rounded-full px-7 text-sm font-medium transition-[transform,background-color,opacity] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed ${welcome ? "bg-ink text-bg" : "bg-ink text-bg disabled:opacity-40"} ${busy && !welcome ? "disabled:opacity-80" : ""}`}
            >
              {/* Three states, one label at a time: ready, working, welcomed. */}
              <AnimatePresence mode="popLayout" initial={false}>
                {welcome ? (
                  <motion.span key="welcome" {...swap} className="inline-flex items-center gap-2">
                    <CheckIcon size={15} weight="bold" aria-hidden />
                    Welcome, {welcome}
                  </motion.span>
                ) : busy ? (
                  <motion.span key="busy" {...swap} className="inline-flex items-center gap-2">
                    <CircleNotchIcon size={15} className="animate-spin" aria-hidden />
                    Sign in
                  </motion.span>
                ) : (
                  <motion.span key="idle" {...swap} className="inline-flex items-center gap-2">
                    Sign in
                    <ArrowRightIcon size={14} aria-hidden className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* A sleeping server is waited for, calmly: a breathing dot and a slow hairline, never an error. */}
            <Collapse show={waking && !welcome}>
              <div className="flex max-w-[40ch] flex-col gap-3 pt-5">
                <p role="status" className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
                  <BreathingDot className="mt-[7px]" />
                  Starting the server. This takes about a minute on the first visit.
                </p>
                <PatientBar />
              </div>
            </Collapse>
          </motion.div>
        </form>

        <motion.p {...enter(5)} className="mt-14 text-xs text-mist">
          Built on the IBM HR Analytics dataset. Names are generated.
        </motion.p>
      </div>
    </div>
  );
}
