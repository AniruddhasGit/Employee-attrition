"use client";

import { CheckIcon, HourglassMediumIcon, ListChecksIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { createPlan, markPlanDone, simulate, type ActionKey, type Levers, type Plan } from "@/lib/api";
import { pct } from "@/lib/format";
import { EASE_OUT, SPRING } from "@/lib/motion";
import { PillButton } from "@/components/ui/PillButton";

const ACTIONS: { key: ActionKey; label: string }[] = [
  { key: "pay_review", label: "Pay review" },
  { key: "promotion", label: "Promotion conversation" },
  { key: "reduce_overtime", label: "Reduce overtime" },
  { key: "stock_grant", label: "Stock grant" },
  { key: "training_plan", label: "Training plan" },
  { key: "reduce_travel", label: "Reduce travel" },
  { key: "stay_interview", label: "Stay interview" },
];

const TRAVEL: Required<Levers>["businessTravel"][] = ["Non-Travel", "Travel_Rarely", "Travel_Frequently"];


/** The lever change each action makes, as the API applies it (api/scoring.py apply_action), for a live preview. */
function actionLevers(action: ActionKey, l: Required<Levers>): Levers {
  switch (action) {
    case "pay_review":
      return { monthlyIncome: Math.round(l.monthlyIncome * 1.1) };
    case "promotion":
      return { jobLevel: Math.min(5, l.jobLevel + 1), yearsSinceLastPromotion: 0 };
    case "reduce_overtime":
      return { overTime: "No" };
    case "stock_grant":
      return { stockOptionLevel: Math.min(3, l.stockOptionLevel + 1) };
    case "training_plan":
      return { trainingTimesLastYear: Math.min(6, l.trainingTimesLastYear + 2) };
    case "reduce_travel":
      return { businessTravel: TRAVEL[Math.max(0, TRAVEL.indexOf(l.businessTravel) - 1)] };
    case "stay_interview":
      return {};
  }
}

export function Estimate({ from, to, large = false }: { from: number; to: number; large?: boolean }) {
  const pts = Math.round((to - from) * 100);
  const pill =
    pts < 0 ? "bg-calm/15 text-calm" : pts > 0 ? "bg-signal-soft text-signal" : "bg-haze/50 text-muted";
  return (
    <p className={`tabular flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-soft ${large ? "text-[0.9375rem]" : "text-sm"}`}>
      <span>
        Model&apos;s estimate: {pct(from)} →{" "}
        <span className={`font-medium ${to < from - 0.005 ? "text-calm" : "text-ink"}`}>{pct(to)}</span>
      </span>
      <span aria-hidden className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill}`}>
        {pts === 0 ? "no change" : `${pts > 0 ? "+" : "−"}${Math.abs(pts)} pts`}
      </span>
    </p>
  );
}

function Actual({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <HourglassMediumIcon size={14} aria-hidden className="text-mist" /> Waiting for next check-in
      </p>
    );
  }
  const pts = Math.round(Math.abs(change) * 100);
  const word = pts === 0 ? "held steady" : change < 0 ? `fell ${pts} pts` : `rose ${pts} pts`;
  return (
    <p
      data-testid="plan-actual"
      className={`tabular text-sm font-medium ${change < 0 && pts ? "text-calm" : change > 0 && pts ? "text-signal" : "text-ink"}`}
    >
      Actual change: {word}
    </p>
  );
}

function PlanItem({ plan, onDone }: { plan: Plan; onDone: (id: number) => Promise<void> }) {
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const done = plan.status === "done";
  // Only a plan finished on this visit gets the check-off moment; ones already done just sit there.
  const [doneOnArrival] = useState(done);
  const justDone = done && !doneOnArrival;

  async function finish() {
    setBusy(true);
    setFailed(false);
    try {
      await onDone(plan.id);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-4 p-4 sm:p-5">
      <span aria-hidden className="relative mt-0.5 grid size-8 shrink-0 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          {done ? (
            <motion.span
              key="done"
              className="grid size-8 place-items-center rounded-full bg-ink text-bg"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduce ? { duration: 0.15 } : SPRING.snappy}
            >
              <motion.span
                className="grid place-items-center"
                initial={reduce ? false : { opacity: 0, scale: 0.4, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ ...SPRING.snappy, delay: 0.06 }}
              >
                <CheckIcon size={14} weight="bold" />
              </motion.span>
            </motion.span>
          ) : (
            <motion.span
              key="open"
              className="grid size-8 place-items-center rounded-full border border-dashed border-mist text-mist"
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}
            >
              <span className="size-1.5 rounded-full bg-current" />
            </motion.span>
          )}
        </AnimatePresence>
        {/* One soft ring that spreads and fades: the plan is checked off. */}
        {justDone && !reduce && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full border border-ink"
            initial={{ opacity: 0.45, scale: 1 }}
            animate={{ opacity: 0, scale: 1.9 }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{plan.label}</h3>
            <motion.span
              key={done ? "done" : "open"}
              initial={justDone && !reduce ? { opacity: 0, scale: 0.85 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING.snappy}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                done ? "bg-ink text-bg" : "border border-line text-muted"
              }`}
            >
              {done ? "Done" : "Open"}
            </motion.span>
            <span className="tabular text-xs text-muted">{plan.createdQuarter}</span>
          </div>
          {plan.note && <p className="mt-1 max-w-[56ch] text-sm text-muted">{plan.note}</p>}
          <div className="mt-2.5 flex flex-col gap-1.5">
            <Estimate from={plan.scoreAtCreation} to={plan.estimatedScore} />
            <Actual change={plan.actualChange} />
          </div>
          {failed && <p className="mt-2 text-sm text-signal">Couldn&apos;t save that. Give it a moment, then click again.</p>}
        </div>
        <AnimatePresence initial={false}>
        {!done && (
          <motion.button
            key="mark"
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.14, ease: EASE_OUT } }}
            type="button"
            onClick={finish}
            disabled={busy}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 self-start rounded-full border border-line bg-surface px-4 text-sm font-medium transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.97] disabled:opacity-50 [@media(hover:hover)]:hover:border-ink/30 [@media(hover:hover)]:hover:bg-bg`}
          >
            <CheckIcon size={14} aria-hidden /> {busy ? "Saving" : "Mark done"}
          </motion.button>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Pick one of the seven actions, see the model's estimate, add it; later mark it done and see what really happened. */
export function ActionPlans({
  personId,
  score,
  levers,
  plans,
  onChanged,
}: {
  personId: number;
  score: number;
  levers: Required<Levers>;
  plans: Plan[];
  onChanged: () => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const [action, setAction] = useState<ActionKey>("pay_review");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<{ action: ActionKey; after: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    simulate(personId, actionLevers(action, levers))
      .then((r) => alive && setPreview({ action, after: r.after }))
      .catch(() => alive && setPreview(null));
    return () => {
      alive = false;
    };
  }, [action, levers, personId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFailed(null);
    try {
      await createPlan(personId, action, note.trim());
      setNote("");
      await onChanged();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function done(id: number) {
    await markPlanDone(id);
    await onChanged();
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={add}
        className="rounded-3xl border border-line bg-surface p-5 shadow-[0_24px_48px_-36px_rgb(27_36_48/0.4)] md:p-7"
      >
        <fieldset>
          <legend className="font-medium">New plan</legend>
          <p className="mb-4 mt-1 text-sm text-muted">Pick one action. The estimate updates as you choose.</p>
          <div role="radiogroup" aria-label="Action" className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <label
                key={a.key}
                className={`relative inline-flex min-h-10 cursor-pointer items-center rounded-full border px-4 text-sm transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.97] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink sm:min-h-9 ${
                  a.key === action ? "border-ink bg-ink text-bg" : `border-line text-ink-soft [@media(hover:hover)]:hover:border-ink/25 [@media(hover:hover)]:hover:bg-bg`
                }`}
              >
                <input
                  type="radio"
                  name="plan-action"
                  className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
                  checked={a.key === action}
                  onChange={() => setAction(a.key)}
                  aria-label={a.label}
                />
                {a.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex min-h-12 items-center rounded-2xl bg-bg px-4 py-3" aria-live="polite">
          {preview?.action === action ? (
            <motion.div
              key={action}
              initial={reduce ? false : { opacity: 0, transform: "translateY(4px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              <Estimate from={score} to={preview.after} large />
            </motion.div>
          ) : (
            <span className="block h-5 w-56 animate-pulse rounded-full bg-haze/60" />
          )}
        </div>
        <label htmlFor="plan-note" className="mt-6 block text-sm font-medium">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="plan-note"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Who owns it, and by when"
          className="mt-2 min-h-11 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-base outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-mist focus:border-ink/40 focus:shadow-[0_0_0_4px_rgb(14_17_22/0.06)] sm:text-sm"
        />
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <PillButton type="submit" variant="dark" disabled={saving}>
            {saving ? "Adding" : "Add plan"}
          </PillButton>
          {failed && <p className="text-sm text-signal">{failed}</p>}
        </div>
      </form>

      <AnimatePresence initial={false}>
        {plans.length === 0 && (
          <motion.div
            key="empty"
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="flex items-center gap-4 rounded-2xl border border-dashed border-line px-5 py-6"
          >
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-mist">
              <ListChecksIcon size={20} />
            </span>
            <div>
              <p className="font-medium">No plans yet for this person</p>
              <p className="mt-0.5 text-sm text-muted">
                Add one above. Once it&apos;s marked done, the next check-in shows what really changed.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Always mounted, so the very first plan animates in too. */}
      <ul className={plans.length ? "flex flex-col gap-3" : "hidden"}>
        <AnimatePresence initial={false} mode="popLayout">
          {plans.map((p) => (
            <motion.li
              key={p.id}
              data-testid="plan"
              layout={!reduce}
              className="rounded-2xl border border-line bg-surface"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, transition: { duration: 0.15, ease: EASE_OUT } }}
              transition={{ duration: 0.3, ease: EASE_OUT, layout: { duration: 0.3, ease: EASE_OUT } }}
            >
              <PlanItem plan={p} onDone={done} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
