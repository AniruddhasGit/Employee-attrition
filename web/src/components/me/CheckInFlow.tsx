"use client";

import { ArrowLeftIcon, CircleNotchIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, getCheckInForm, submitCheckIn, type Answers, type CheckInForm, type Option } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";
import { ErrorState } from "@/components/ui/ErrorState";
import { PillButton } from "@/components/ui/PillButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { KeepMePicker } from "./KeepMePicker";
import { Question } from "./Question";
import { fmtQuarter } from "./labels";

type Load = { status: "loading" } | { status: "error"; error: ApiError } | { status: "ready"; form: CheckInForm };

const shell = "mx-auto max-w-[1400px] px-4 pb-24 pt-10 md:px-8 md:pt-16";

/** The quarterly check-in: one question per screen, then what would keep you here. Prefills a re-take. */
export function CheckInFlow() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [picks, setPicks] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [moved, setMoved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const fetchForm = useCallback(() => {
    getCheckInForm()
      .then((form) => {
        if (form.current) {
          setAnswers(form.current.answers);
          setPicks(form.current.keepMe);
          setComment(form.current.comment ?? "");
        }
        setLoad({ status: "ready", form });
      })
      .catch((e) => setLoad({ status: "error", error: e instanceof ApiError ? e : new ApiError(0, "") }));
  }, []);

  useEffect(fetchForm, [fetchForm]);

  // Next keeps a route's state alive (hidden) after leaving it; start over on the next visit.
  useLayoutEffect(
    () => () => {
      setLoad({ status: "loading" });
      setAnswers({});
      setPicks([]);
      setComment("");
      setStep(0);
      setDir(1);
      setMoved(false);
      setSending(false);
      setSendError(null);
    },
    [],
  );

  if (load.status === "loading") return <FlowSkeleton />;
  if (load.status === "error") {
    return (
      <div className={shell}>
        <ErrorState
          status={load.error.status}
          message={load.error.message}
          onRetry={() => {
            setLoad({ status: "loading" });
            fetchForm();
          }}
        />
      </div>
    );
  }

  const { form } = load;
  const total = form.questions.length + 1;
  const last = step === total - 1;
  const question = last ? null : form.questions[step];
  const answered = question ? answers[question.key] !== undefined : true;

  function go(to: number) {
    setDir(to > step ? 1 : -1);
    setMoved(true);
    setStep(to);
  }

  function next() {
    if (answered && !last) go(step + 1);
  }

  async function submit() {
    setSending(true);
    setSendError(null);
    try {
      await submitCheckIn({ answers: answers as Answers, keepMe: picks, comment: comment.trim() });
      router.push("/me");
    } catch (e) {
      setSending(false);
      setSendError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className={shell}>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <p className="inline-flex items-center gap-2 text-muted">
            <span aria-hidden className="size-1.5 rounded-full bg-calm" />
            {fmtQuarter(form.quarter)} check-in{form.current ? " · updating your answers" : ""}
          </p>
          <p className="font-mono text-xs tabular-nums text-muted">
            {step + 1} of {total}
          </p>
        </div>
        <Progress step={step} total={total} />

        <div className="mt-10 md:mt-14">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <Step key={step} dir={dir} focusOnEnter={moved}>
              {step === 0 && (
                <div className="mb-10 flex items-start gap-4 rounded-2xl border border-line bg-surface p-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-calm/15 text-calm">
                    <EyeSlashIcon size={18} aria-hidden />
                  </span>
                  <p className="self-center text-sm leading-relaxed text-ink-soft">{form.notice}</p>
                </div>
              )}
              {question ? (
                <>
                  <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted">Question {step + 1}</p>
                  <StepTitle id={`q-${step}`}>{question.label}</StepTitle>
                  <div className="mt-10">
                    <Question
                      question={question}
                      value={answers[question.key] as Option["value"] | undefined}
                      onChange={(v) => setAnswers((a) => ({ ...a, [question.key]: v }))}
                      onEnter={next}
                      labelledBy={`q-${step}`}
                    />
                  </div>
                  <p className="mt-5 hidden items-center gap-2 text-xs text-muted md:flex">
                    <Kbd>←</Kbd>
                    <Kbd>→</Kbd> move between answers
                    <span className="mx-1 text-haze">·</span>
                    <Kbd>Enter</Kbd> goes on
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted">Last step</p>
                  <StepTitle id="q-keep">What would keep you here</StepTitle>
                  <p className="mt-3 max-w-[52ch] text-muted">Pick up to three. HR sees these with your name, and adds them up by team to see what matters most.</p>
                  <div className="mt-8">
                    <KeepMePicker options={form.keepMeOptions} picks={picks} onPicks={setPicks} comment={comment} onComment={setComment} />
                  </div>
                </>
              )}
            </Step>
          </AnimatePresence>
        </div>

        {sendError && (
          <p role="alert" className="mt-8 text-sm text-signal">
            {sendError}
          </p>
        )}

        <div className="sticky bottom-0 z-20 -mx-4 mt-10 flex items-center justify-between gap-4 border-t border-line bg-bg/85 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md md:static md:mx-0 md:mt-12 md:bg-transparent md:px-0 md:pb-0 md:pt-6 md:backdrop-blur-none">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={step === 0 || sending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-sm text-ink-soft outline-none transition-[transform,translate,scale,background-color] duration-150 ease-out hover:bg-surface focus-visible:ring-2 focus-visible:ring-calm focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.97] disabled:invisible"
          >
            <ArrowLeftIcon size={14} aria-hidden /> Back
          </button>
          {last ? (
            <PillButton type="button" variant="dark" onClick={submit} disabled={sending} className="disabled:opacity-60">
              <span className="inline-flex items-center gap-2">
                {sending && <CircleNotchIcon size={14} className="animate-spin" aria-hidden />}
                Submit
              </span>
            </PillButton>
          ) : (
            <PillButton type="button" variant="dark" onClick={next} disabled={!answered} className="disabled:pointer-events-none disabled:opacity-40">
              Next
            </PillButton>
          )}
        </div>
      </div>
    </div>
  );
}

/** One screen of the flow. Slides in the direction of travel (fade only under reduced motion); inert while leaving. */
function Step({ dir, focusOnEnter, children }: { dir: number; focusOnEnter: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  const present = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  const x = (d: number) => (reduce ? "translateX(0px)" : `translateX(${d * 32}px)`);

  useEffect(() => {
    // After Next/Back, put focus on the answer so arrow keys work at once.
    if (!focusOnEnter) return;
    const target = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>("h1");
    target?.focus({ preventScroll: true });
  }, [focusOnEnter]);

  return (
    <motion.div
      ref={ref}
      inert={!present}
      initial={{ opacity: 0, transform: x(dir) }}
      animate={{ opacity: 1, transform: "translateX(0px)", transition: { duration: 0.2, ease: EASE_OUT } }}
      exit={{ opacity: 0, transform: x(-dir), transition: { duration: 0.12, ease: EASE_OUT } }}
    >
      {children}
    </motion.div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid min-w-6 place-items-center rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-soft shadow-[0_1px_0_var(--line)]">
      {children}
    </kbd>
  );
}

function StepTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h1 id={id} tabIndex={-1} className="max-w-[22ch] text-[clamp(1.875rem,4.2vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-balance outline-none">
      {children}
    </h1>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="mt-3 flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-haze/70">
          <span
            className="block h-full origin-left rounded-full bg-ink transition-transform duration-300 ease-out"
            style={{ transform: i <= step ? "scaleX(1)" : "scaleX(0)" }}
          />
        </span>
      ))}
    </div>
  );
}

function FlowSkeleton() {
  return (
    <div className={shell} aria-busy="true">
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-1" />
        <Skeleton className="mt-14 h-20" />
        <Skeleton className="mt-10 h-12 w-4/5" />
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 md:h-36" />
          ))}
        </div>
      </div>
    </div>
  );
}
