"use client";

import { CheckIcon, HourglassMediumIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { createPlan, markPlanDone, simulate, type ActionKey, type Levers, type Plan } from "@/lib/api";
import { pct } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
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

export function Estimate({ from, to }: { from: number; to: number }) {
  return (
    <p className="tabular text-sm text-ink-soft">
      Model&apos;s estimate: {pct(from)} → <span className={to < from - 0.005 ? "text-calm" : ""}>{pct(to)}</span>
    </p>
  );
}

function Actual({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <HourglassMediumIcon size={14} aria-hidden /> Waiting for next check-in
      </p>
    );
  }
  const pts = Math.round(Math.abs(change) * 100);
  const word = pts === 0 ? "held steady" : change < 0 ? `fell ${pts} pts` : `rose ${pts} pts`;
  return (
    <p data-testid="plan-actual" className={`tabular text-sm font-medium ${change < 0 && pts ? "text-calm" : change > 0 && pts ? "text-signal" : "text-ink"}`}>
      Actual change: {word}
    </p>
  );
}

function PlanItem({ plan, onDone }: { plan: Plan; onDone: (id: number) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const done = plan.status === "done";

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
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{plan.label}</h3>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
              done ? "bg-ink text-bg" : "border border-line text-muted"
            }`}
          >
            {done && <CheckIcon size={11} weight="bold" aria-hidden />}
            {done ? "Done" : "Open"}
          </span>
          <span className="tabular text-xs text-muted">{plan.createdQuarter}</span>
        </div>
        {plan.note && <p className="mt-1 max-w-[56ch] text-sm text-muted">{plan.note}</p>}
        <div className="mt-2 flex flex-col gap-1">
          <Estimate from={plan.scoreAtCreation} to={plan.estimatedScore} />
          <Actual change={plan.actualChange} />
        </div>
        {failed && <p className="mt-2 text-sm text-signal">Couldn&apos;t save that. Give it a moment, then click again.</p>}
      </div>
      {!done && (
        <button
          type="button"
          onClick={finish}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-line px-4 py-1.5 text-sm transition-[transform,background-color] duration-150 ease-out hover:bg-bg active:scale-[0.97] disabled:opacity-50"
        >
          <CheckIcon size={14} aria-hidden /> {busy ? "Saving" : "Mark done"}
        </button>
      )}
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
    <div className="flex flex-col gap-10">
      <form onSubmit={add} className="rounded-2xl border border-line bg-surface p-5 md:p-6">
        <fieldset>
          <legend className="mb-3 text-sm font-medium">New plan</legend>
          <div role="radiogroup" aria-label="Action" className="flex flex-wrap gap-1.5">
            {ACTIONS.map((a) => (
              <label
                key={a.key}
                className={`relative cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors duration-150 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal ${
                  a.key === action ? "bg-ink text-bg" : "border border-line text-ink-soft hover:bg-bg"
                }`}
              >
                <input type="radio" name="plan-action" className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0" checked={a.key === action} onChange={() => setAction(a.key)} aria-label={a.label} />
                {a.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 min-h-5" aria-live="polite">
          {preview?.action === action ? <Estimate from={score} to={preview.after} /> : <span className="block h-5 w-56 animate-pulse rounded-full bg-haze/50" />}
        </div>
        <label htmlFor="plan-note" className="mt-5 block text-sm font-medium">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="plan-note"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Who owns it, and by when"
          className="mt-2 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors duration-150 placeholder:text-mist focus:border-ink/40"
        />
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <PillButton type="submit" variant="dark" disabled={saving}>
            {saving ? "Adding" : "Add plan"}
          </PillButton>
          {failed && <p className="text-sm text-signal">{failed}</p>}
        </div>
      </form>

      {plans.length === 0 ? (
        <p className="text-muted">No plans yet for this person.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          <AnimatePresence initial={false}>
            {plans.map((p) => (
              <motion.li
                key={p.id}
                data-testid="plan"
                layout={!reduce}
                initial={{ opacity: 0, transform: reduce ? "none" : "translateY(-8px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                <PlanItem plan={p} onDone={done} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
