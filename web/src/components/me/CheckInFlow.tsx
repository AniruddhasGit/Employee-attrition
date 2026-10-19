"use client";

import { ArrowLeftIcon, CircleNotchIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type Variants } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { ApiError, getCheckInForm, sendCheckIn, type Answers, type CheckInForm, type Option, type Question as CoreQuestion } from "@/lib/api";
import { EASE_OUT, SPRING } from "@/lib/motion";
import { ErrorState } from "@/components/ui/ErrorState";
import { PillButton } from "@/components/ui/PillButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { KeepMePicker } from "./KeepMePicker";
import { Question } from "./Question";
import { fmtQuarter } from "./labels";

type Load = { status: "loading" } | { status: "error"; error: ApiError } | { status: "ready"; form: CheckInForm };

/** One screen before the last: a core question, the stay-intent question, or a question HR added. */
type Ask =
  | { kind: "core"; question: CoreQuestion }
  | { kind: "intent"; label: string; options: Option[] }
  | { kind: "custom"; id: string; label: string; options: Option[] };

function asks(form: CheckInForm): Ask[] {
  return [
    ...form.questions.map((question) => ({ kind: "core" as const, question })),
    { kind: "intent" as const, label: form.intentQuestion.label, options: form.intentQuestion.options },
    ...form.customQuestions.map((q) => ({ kind: "custom" as const, id: String(q.id), label: q.label, options: q.options })),
  ];
}

const shell = "mx-auto max-w-[1400px] px-4 pb-24 pt-10 md:px-8 md:pt-16";

/** The quarterly check-in: one question per screen, then what would keep you here. Prefills a re-take. */
export function CheckInFlow() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [custom, setCustom] = useState<Record<string, number>>({});
  const [intent, setIntent] = useState<number | undefined>(undefined);
  const [picks, setPicks] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [moved, setMoved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const reduce = useReducedMotion();

  const fetchForm = useCallback(() => {
    getCheckInForm()
      .then((form) => {
        if (form.current) {
          setAnswers(form.current.answers);
          setPicks(form.current.keepMe);
          setComment(form.current.comment ?? "");
          setCustom(form.current.custom ?? {});
          setIntent(form.current.stayIntent ?? undefined);
          // Updating a finished check-in (say HR added questions): open on the first one still unanswered.
          const { custom: had, stayIntent } = form.current;
          const open = asks(form).findIndex((q) =>
            q.kind === "intent" ? stayIntent == null : q.kind === "custom" ? had?.[q.id] === undefined : false,
          );
          if (open > 0) setStep(open);
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
      setCustom({});
      setIntent(undefined);
      setPicks([]);
      setComment("");
      setStep(0);
      setDir(1);
      setMoved(false);
      setSending(false);
      setSendError(null);
      setSent(false);
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
  const steps = asks(form);
  const total = steps.length + 1;
  const last = step === total - 1;
  const ask = last ? null : steps[step];
  const value: Option["value"] | undefined =
    ask?.kind === "core" ? answers[ask.question.key] : ask?.kind === "intent" ? intent : ask ? custom[ask.id] : undefined;
  const answered = ask ? value !== undefined : true;

  function choose(v: Option["value"]) {
    if (!ask) return;
    if (ask.kind === "core") setAnswers((a) => ({ ...a, [ask.question.key]: v }));
    else if (ask.kind === "intent") setIntent(Number(v));
    else setCustom((c) => ({ ...c, [ask.id]: Number(v) }));
  }

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
      await sendCheckIn({ answers: answers as Answers, custom, stayIntent: intent!, keepMe: picks, comment: comment.trim() });
      // A short, calm moment of done before heading home (shorter without motion).
      router.prefetch("/me");
      setSent(true);
      setTimeout(() => router.push("/me"), reduce ? 700 : 1500);
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
          <p className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-muted">
            {step + 1} of {total}
          </p>
        </div>
        <Progress step={sent ? total : step} total={total} />

        {sent ? (
          <Sent />
        ) : (
          <>
          {/* Clips the sideways slide on small screens (with room for focus rings) so it never adds a horizontal scroll. */}
          <div className="relative -mx-4 mt-10 overflow-x-clip px-4 md:mt-14 lg:overflow-x-visible">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <Step key={step} dir={dir} focusOnEnter={moved}>
                {step === 0 && (
                  <div className="mb-10 flex items-start gap-4 rounded-2xl border border-line bg-surface p-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-calm/15 text-calm">
                      <EyeSlashIcon size={18} aria-hidden />
                    </span>
                    <p className="self-center text-sm leading-relaxed text-ink-soft">{form.notice}</p>
                  </div>
                )}
                {ask ? (
                  <>
                    <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted">
                      Question {step + 1}
                      {ask.kind === "custom" && <span className="text-calm"> · new from HR</span>}
                    </p>
                    <StepTitle id={`q-${step}`}>{ask.kind === "core" ? ask.question.label : ask.label}</StepTitle>
                    <div className="mt-10">
                      <Question
                        question={ask.kind === "core" ? ask.question : { kind: "choice", options: ask.options }}
                        value={value}
                        onChange={choose}
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
          </>
        )}
      </div>
    </div>
  );
}

const SLIDE = 48;

/**
 * Next slides the new step in from the right while the old one leaves to the left; Back mirrors it.
 * The direction comes through AnimatePresence `custom`, so the leaving step uses the latest one.
 */
const slide: Variants = {
  enter: (d: number) => ({ opacity: 0, transform: `translateX(${d * SLIDE}px)`, filter: "blur(4px)" }),
  center: { opacity: 1, transform: "translateX(0px)", filter: "blur(0px)", transition: { duration: 0.42, ease: EASE_OUT } },
  exit: (d: number) => ({
    opacity: 0,
    transform: `translateX(${d * -SLIDE}px)`,
    filter: "blur(4px)",
    transition: { duration: 0.22, ease: EASE_OUT },
  }),
};
const fade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

/** One screen of the flow. Slides in the direction of travel (fade only under reduced motion); inert and hidden from assistive tech while leaving. */
function Step({
  dir,
  focusOnEnter,
  children,
  ref: outer,
}: {
  dir: number;
  focusOnEnter: boolean;
  children: ReactNode;
  /** AnimatePresence's popLayout measures the leaving step through this. */
  ref?: Ref<HTMLDivElement>;
}) {
  const reduce = useReducedMotion();
  const present = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      if (typeof outer === "function") outer(el);
      else if (outer) outer.current = el;
    },
    [outer],
  );

  useEffect(() => {
    // After Next/Back, put focus on the answer so arrow keys work at once.
    if (!focusOnEnter) return;
    const target = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>("h1");
    target?.focus({ preventScroll: true });
  }, [focusOnEnter]);

  return (
    <motion.div
      ref={setRef}
      inert={!present}
      aria-hidden={present ? undefined : true}
      custom={dir}
      variants={reduce ? fade : slide}
      initial="enter"
      animate="center"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

/** The moment after Submit: a ring closes, the check mark draws itself, a few sparks drift out, then home. */
function Sent() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center outline-none md:min-h-[56vh]"
    >
      <div className="relative grid size-24 place-items-center">
        {!reduce &&
          SPARKS.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute left-1/2 top-1/2 rounded-full bg-calm"
              style={{ width: p.r * 2, height: p.r * 2, marginLeft: -p.r, marginTop: -p.r }}
              initial={{ opacity: 0, transform: "translate(0px, 0px) scale(0.6)" }}
              animate={{
                opacity: [0, 1, 0],
                transform: [
                  "translate(0px, 0px) scale(0.6)",
                  `translate(${p.x * 60}px, ${p.y * 60}px) scale(1)`,
                  `translate(${p.x * 76}px, ${p.y * 76}px) scale(0.4)`,
                ],
              }}
              transition={{ duration: 0.9, delay: 0.5, ease: EASE_OUT, times: [0, 0.45, 1] }}
            />
          ))}
        <motion.svg
          viewBox="0 0 96 96"
          className="size-24 text-calm"
          aria-hidden
          initial={reduce ? false : { opacity: 0, transform: "scale(0.86)" }}
          animate={{ opacity: 1, transform: "scale(1)" }}
          transition={{ ...SPRING.soft, opacity: { duration: 0.2 } }}
        >
          <circle cx="48" cy="48" r="46" fill="currentColor" fillOpacity={0.12} />
          <motion.circle
            cx="48"
            cy="48"
            r="46"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            transform="rotate(-90 48 48)"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          />
          <motion.path
            d="M31 49.5 42.5 61 66 36"
            fill="none"
            stroke="var(--ink)"
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.38, delay: 0.36, ease: EASE_OUT }}
          />
        </motion.svg>
      </div>
      <motion.p
        className="mt-8 text-[clamp(1.875rem,4.2vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.035em]"
        initial={reduce ? false : { opacity: 0, transform: "translateY(10px)", filter: "blur(4px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }}
        transition={{ duration: 0.6, delay: 0.45, ease: EASE_OUT }}
      >
        Sent. Thank you.
      </motion.p>
    </div>
  );
}

/** Eight small dots evenly around the ring, alternating sizes. */
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  return { x: Math.cos(a), y: Math.sin(a), r: i % 2 ? 2 : 3 };
});

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

/** One segment per step. Each fills on a spring as you reach it, and empties as you go back. */
function Progress({ step, total }: { step: number; total: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="mt-3 flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-haze/70">
          <motion.span
            className="block h-full origin-left rounded-full bg-ink"
            initial={false}
            animate={{ transform: i <= step ? "scaleX(1)" : "scaleX(0)" }}
            transition={reduce ? { duration: 0 } : SPRING.soft}
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
