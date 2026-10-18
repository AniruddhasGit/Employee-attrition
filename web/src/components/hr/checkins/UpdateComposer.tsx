"use client";

import { CaretDownIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, postUpdate, type CheckInStatus } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";
import { PillButton } from "@/components/ui/PillButton";

type Update = CheckInStatus["updates"][number];

const MAX = 280;

const fieldCls =
  "w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-base leading-relaxed transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-mist focus:border-ink/40 focus:shadow-[0_0_0_3px_rgb(127_140_153/0.18)] focus:outline-none";

function Field({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: "said" | "did";
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const near = value.length >= MAX - 20;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span
          id={`${id}-count`}
          data-testid={`${id}-count`}
          className={`tabular text-xs transition-colors duration-150 ease-out ${near ? "font-medium text-ink" : "text-muted"}`}
        >
          {value.length}/{MAX}
        </span>
      </div>
      <textarea
        id={id}
        rows={3}
        maxLength={MAX}
        aria-describedby={`${id}-count`}
        value={value}
        placeholder={hint}
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
        className={`mt-2 resize-none ${fieldCls}`}
      />
    </div>
  );
}

/** "You said, we did": tell one department what changed because of their check-ins. */
export function UpdateComposer({ departments, onPosted }: { departments: string[]; onPosted: (u: Update) => void }) {
  const reduce = useReducedMotion();
  const [department, setDepartment] = useState(departments[0] ?? "");
  const [said, setSaid] = useState("");
  const [did, setDid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const ready = department && said.trim() && did.trim() && !busy;

  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(null), 3200);
    return () => clearTimeout(t);
  }, [sent]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const u = await postUpdate({ department, said: said.trim(), did: did.trim() });
      onPosted(u);
      setSaid("");
      setDid("");
      setSent(u.department);
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0 ? err.message : "Couldn't post that. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-6 md:p-8">
      <h3 className="text-xl font-semibold tracking-tight">Post an update</h3>
      <p className="mt-1 text-sm text-muted">Everyone in the department sees it on their home page.</p>

      <div className="mt-7 space-y-6">
        <div>
          <label htmlFor="department" className="text-sm font-medium">
            Department
          </label>
          <div className="relative mt-2">
            <select
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={`appearance-none pr-10 ${fieldCls}`}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <CaretDownIcon
              size={14}
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted"
            />
          </div>
        </div>
        <Field id="said" label="You said" hint="What people told you in their check-ins" value={said} onChange={setSaid} />
        <Field id="did" label="We did" hint="What changed because of it" value={did} onChange={setDid} />
      </div>

      {error && (
        <p role="alert" className="mt-5 text-sm text-signal">
          {error}
        </p>
      )}

      <div className="mt-7 flex min-h-11 items-center justify-between gap-4">
        <p aria-live="polite" className="min-w-0 text-sm text-ink-soft">
          <AnimatePresence>
            {sent && (
              <motion.span
                key={sent}
                className="flex items-center gap-1.5"
                initial={{ opacity: 0, transform: reduce ? "translateY(0px)" : "translateY(4px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                <CheckCircleIcon size={16} weight="fill" aria-hidden className="shrink-0 text-calm" />
                <span className="truncate">Sent to {sent}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </p>
        <PillButton type="submit" variant="dark" disabled={!ready} className="shrink-0 disabled:opacity-40">
          {busy ? "Posting…" : "Post update"}
        </PillButton>
      </div>
    </form>
  );
}
