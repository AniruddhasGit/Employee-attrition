"use client";

import { ArrowRightIcon, CheckIcon, CircleNotchIcon, EyeIcon, EyeSlashIcon, SignOutIcon, WarningIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiError, setPassword, signOut } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";
import { firstName, MIN_PASSWORD, passwordProblem } from "@/lib/onboard";
import { useSession } from "@/lib/session";
import { SITE } from "@/lib/site";
import { Logo } from "@/components/site/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { WordReveal } from "@/components/ui/motion";
import { CheckInPanel } from "./CheckInPanel";
import { BreathingDot, Collapse, useLabelSwap, usePanelEnter, useRowEnter } from "./motion";
import { field, noRing, underline } from "./fields";

/** How long the "You're in" state shows before the page changes. */
const DONE_MS = 500;

/** Slim header for the first sign-in: the mark, and a way out. No area links yet. */
function WelcomeHeader() {
  const [leaving, setLeaving] = useState(false);

  async function onSignOut() {
    setLeaving(true);
    await signOut().catch(() => undefined);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load is the point
    window.location.assign("/login");
  }

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Logo />
          {SITE.name}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          disabled={leaving}
          className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3.5 text-sm transition-transform duration-150 ease-out hover:bg-surface active:scale-[0.97] disabled:opacity-60"
        >
          <SignOutIcon size={15} aria-hidden /> Sign out
        </button>
      </div>
    </header>
  );
}

/**
 * First sign-in on the temporary password HR handed over: choose your own, then go home.
 * Accounts that already have their own password are sent straight on.
 */
export function WelcomeForm() {
  const state = useSession();
  const router = useRouter();
  const reduce = useReducedMotion();
  const ids = useId();
  const [password, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confirmLeft, setConfirmLeft] = useState(false);
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = state.status === "signed-in" ? state.session : null;
  const ready = session?.mustChangePassword === true;

  useEffect(() => {
    if (state.status === "signed-out") router.replace("/login?next=%2Fwelcome");
    else if (session && !session.mustChangePassword) router.replace(session.home);
  }, [state.status, session, router]);

  const long = password.length >= MIN_PASSWORD;
  // Say "doesn't match" once it can't become a match by typing on, or after leaving the field.
  const mismatch = confirm.length > 0 && confirm !== password && (confirmLeft || !password.startsWith(confirm));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await setPassword(password);
      setDone(true);
      window.setTimeout(() => {
        // Full page load, so the area opens with the account's fresh session state.
        window.location.assign(next.home);
      }, DONE_MS);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && (err.status === 0 || err.status === 502)) {
        setError("Can't reach the server. Wait a moment, then save again.");
      } else if (err instanceof ApiError && err.status === 409 && session) {
        window.location.assign(session.role === "hr" ? "/hr" : "/me");
      } else {
        setError(err instanceof ApiError && err.status !== 422 ? err.message : "That password can't be used. Pick another.");
      }
    }
  }

  function readCaps(e: KeyboardEvent<HTMLInputElement>) {
    setCaps(e.getModifierState("CapsLock"));
  }

  const enter = useRowEnter();
  const swap = useLabelSwap();
  const panel = usePanelEnter();

  const locked = busy || done;

  return (
    <>
      <WelcomeHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1400px] grid-cols-1 gap-10 px-4 pb-16 pt-8 md:px-8 md:pt-12 lg:grid-cols-12 lg:gap-16">
          <motion.div {...panel} className="order-last lg:order-none lg:col-span-7">
            <CheckInPanel />
          </motion.div>

          <div className="flex flex-col justify-center lg:col-span-5 lg:py-10">
            {!ready ? (
              <div aria-busy="true" aria-label="Loading">
                <Skeleton className="h-4 w-32 rounded-full" />
                <Skeleton className="mt-5 h-20 w-[min(22rem,90%)]" />
                <Skeleton className="mt-12 h-10 w-full" />
                <Skeleton className="mt-9 h-10 w-full" />
              </div>
            ) : (
              <>
                <motion.p {...enter(0)} className="flex items-center gap-2 text-sm text-muted">
                  <BreathingDot />
                  Welcome, {firstName(session.displayName)}.
                </motion.p>
                <WordReveal
                  text="Make it yours."
                  delay={0.1}
                  className="mt-4 text-[clamp(3.25rem,8vw,6.5rem)] font-semibold leading-[0.9] tracking-[-0.05em]"
                />
                <motion.p {...enter(2)} className="mt-5 max-w-[42ch] leading-relaxed text-muted">
                  You signed in with the temporary password HR gave you. Choose one only you know, and you&apos;re in.
                </motion.p>

                <form onSubmit={onSubmit} className="mt-12 flex flex-col gap-9" noValidate>
                  <motion.div {...enter(3)} className="flex flex-col gap-1.5">
                    <label htmlFor={`${ids}-new`} className="text-sm text-muted">
                      New password
                    </label>
                    <div className="relative">
                      <input
                        id={`${ids}-new`}
                        type={shown ? "text" : "password"}
                        name="new-password"
                        autoComplete="new-password"
                        required
                        minLength={MIN_PASSWORD}
                        maxLength={200}
                        value={password}
                        onChange={(e) => setPw(e.target.value)}
                        onKeyDown={readCaps}
                        onKeyUp={readCaps}
                        onBlur={() => setCaps(false)}
                        aria-describedby={`${ids}-hint`}
                        className={`${field} pr-11`}
                        style={noRing}
                      />
                      <span aria-hidden className={underline} />
                      <button
                        type="button"
                        onClick={() => setShown((s) => !s)}
                        aria-pressed={shown}
                        aria-controls={`${ids}-new ${ids}-confirm`}
                        className="absolute bottom-1.5 right-0 grid size-9 place-items-center rounded-full text-muted transition-[color,transform] duration-150 ease-out hover:text-ink active:scale-[0.92]"
                      >
                        <span className="sr-only">{shown ? "Hide passwords" : "Show passwords"}</span>
                        {shown ? <EyeSlashIcon size={18} aria-hidden /> : <EyeIcon size={18} aria-hidden />}
                      </button>
                    </div>
                    <p
                      id={`${ids}-hint`}
                      className={`flex items-center gap-1.5 pt-1 text-sm transition-colors duration-200 ${long ? "text-ink-soft" : "text-muted"}`}
                    >
                      <span
                        aria-hidden
                        className={`grid size-4 place-items-center rounded-full transition-[background-color,color] duration-200 ${long ? "bg-ink text-bg" : "ring-1 ring-line"}`}
                      >
                        {long && <CheckIcon size={10} weight="bold" />}
                      </span>
                      At least {MIN_PASSWORD} characters. A short sentence works well.
                    </p>
                    <AnimatePresence initial={false}>
                      {caps && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
                          className="flex items-center gap-1.5 overflow-hidden text-sm text-ink-soft"
                        >
                          <WarningIcon size={14} aria-hidden />
                          Caps Lock is on.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <motion.div {...enter(4)} className="flex flex-col gap-1.5">
                    <label htmlFor={`${ids}-confirm`} className="text-sm text-muted">
                      Confirm password
                    </label>
                    <div className="relative">
                      <input
                        id={`${ids}-confirm`}
                        type={shown ? "text" : "password"}
                        name="confirm-password"
                        autoComplete="new-password"
                        required
                        maxLength={200}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        onKeyDown={readCaps}
                        onKeyUp={readCaps}
                        onBlur={() => {
                          setCaps(false);
                          setConfirmLeft(true);
                        }}
                        aria-invalid={mismatch || undefined}
                        aria-describedby={mismatch ? `${ids}-mismatch` : undefined}
                        className={field}
                        style={noRing}
                      />
                      <span aria-hidden className={underline} />
                    </div>
                    <AnimatePresence initial={false}>
                      {mismatch && (
                        <motion.p
                          id={`${ids}-mismatch`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
                          className="overflow-hidden pt-1 text-sm text-signal"
                        >
                          The two passwords don&apos;t match.
                        </motion.p>
                      )}
                    </AnimatePresence>
                    <Collapse show={error !== null}>
                      <p role="alert" className="mt-4 border-l-2 border-signal pl-3 text-sm leading-relaxed text-signal">
                        {error}
                      </p>
                    </Collapse>
                  </motion.div>

                  <motion.div {...enter(5)} className="flex items-center gap-5">
                    <button
                      type="submit"
                      disabled={locked || !long || !confirm}
                      className={`relative inline-flex h-12 min-w-[11rem] items-center justify-center overflow-hidden rounded-full bg-ink px-7 text-sm font-medium text-bg transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed ${locked ? "disabled:opacity-80" : "disabled:opacity-40"}`}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        {done ? (
                          <motion.span key="done" {...swap} className="inline-flex items-center gap-2">
                            <CheckIcon size={15} weight="bold" aria-hidden />
                            You&apos;re in
                          </motion.span>
                        ) : busy ? (
                          <motion.span key="busy" {...swap} className="inline-flex items-center gap-2">
                            <CircleNotchIcon size={15} className="animate-spin" aria-hidden />
                            Save password
                          </motion.span>
                        ) : (
                          <motion.span key="idle" {...swap} className="inline-flex items-center gap-2">
                            Save password
                            <ArrowRightIcon size={14} aria-hidden />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </motion.div>
                </form>

                <motion.p {...enter(6)} className="mt-14 max-w-[44ch] text-xs leading-relaxed text-mist">
                  The temporary password stops working once you save. Any other signed-in browser is signed out.
                </motion.p>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
