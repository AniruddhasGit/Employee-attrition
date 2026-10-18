"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { ApiError, postUpdate, type CheckInStatus } from "@/lib/api";
import { PillButton } from "@/components/ui/PillButton";

type Update = CheckInStatus["updates"][number];

const MAX = 280;

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
          className={`tabular text-xs transition-colors duration-150 ease-out ${near ? "text-ink" : "text-muted"}`}
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
        className="mt-2 w-full resize-none border-b border-line bg-transparent pb-2 text-base leading-relaxed placeholder:text-mist focus:border-ink focus:outline-none"
      />
    </div>
  );
}

/** "You said, we did": tell one department what changed because of their check-ins. */
export function UpdateComposer({ departments, onPosted }: { departments: string[]; onPosted: (u: Update) => void }) {
  const [department, setDepartment] = useState(departments[0] ?? "");
  const [said, setSaid] = useState("");
  const [did, setDid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = department && said.trim() && did.trim() && !busy;

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

      <div className="mt-8 space-y-7">
        <div>
          <label htmlFor="department" className="text-sm font-medium">
            Department
          </label>
          <div className="relative mt-2">
            <select
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full appearance-none border-b border-line bg-transparent pr-8 pb-2 text-base focus:border-ink focus:outline-none"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <CaretDownIcon size={14} aria-hidden className="pointer-events-none absolute top-1.5 right-1 text-muted" />
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

      <div className="mt-8 flex justify-end">
        <PillButton type="submit" variant="dark" disabled={!ready} className="disabled:opacity-40">
          {busy ? "Posting…" : "Post update"}
        </PillButton>
      </div>
    </form>
  );
}
