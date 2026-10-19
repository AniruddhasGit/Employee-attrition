"use client";

import { ArrowLeftIcon, ArrowsClockwiseIcon, CaretDownIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { addPerson, ApiError, getRoles, type AddedPerson, type RoleCatalog, type Travel } from "@/lib/api";
import { EASE_OUT } from "@/lib/motion";
import { checkPerson, generatePassword, MIN_TEMP_PASSWORD, type DraftField, type PersonDraft } from "@/lib/onboard";
import { useApi } from "@/lib/useApi";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Segmented } from "../LeverPanel";
import { CrossFade } from "../CrossFade";
import { Added } from "./Added";

const SHELL = "mx-auto max-w-[1400px] px-4 pb-24 pt-10 md:px-8 md:pt-14";

const fieldCls =
  "w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-base leading-relaxed transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-mist focus:border-ink/40 focus:shadow-[0_0_0_3px_rgb(127_140_153/0.18)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-signal/70";

const TRAVEL: Travel[] = ["Non-Travel", "Travel_Rarely", "Travel_Frequently"];
const TRAVEL_LABEL: Record<Travel, string> = {
  "Non-Travel": "No travel",
  Travel_Rarely: "Now and then",
  Travel_Frequently: "Often",
};

const EMPTY: PersonDraft = {
  name: "",
  email: "",
  password: "",
  department: "",
  jobRole: "",
  jobLevel: 1,
  monthlyIncome: "",
  yearsAtCompany: "0",
  overTime: "No",
  businessTravel: "Travel_Rarely",
};

/** The order fields appear in, so the first problem gets focus. */
const ORDER: DraftField[] = ["name", "email", "password", "department", "jobRole", "monthlyIncome", "yearsAtCompany"];

/** A labelled field with its hint, or its problem once the form has been sent. */
function Field({
  id,
  label,
  hint,
  problem,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  problem?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {problem ? (
        <p id={`${id}-note`} className="mt-1.5 text-sm text-signal">
          {problem}
        </p>
      ) : hint ? (
        <p id={`${id}-note`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  disabled,
  invalid,
  placeholder,
  options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  placeholder: string;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-note`}
        onChange={(e) => onChange(e.target.value)}
        className={`cursor-pointer appearance-none pr-10 ${value ? "" : "text-mist"} ${fieldCls}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <CaretDownIcon size={14} aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

/** One numbered group of the form, styled like the dashboard's section kickers. */
function Group({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    // Each card rises in as it reaches the viewport; the first ones follow the header in a short cascade.
    <motion.fieldset
      initial={{ opacity: 0, y: reduce ? 0 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduce ? 0.2 : 0.6, delay: reduce ? 0 : 0.12 + (Number(n) - 1) * 0.07, ease: EASE_OUT }}
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6 md:p-8"
    >
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.14em] text-muted">
        <span className="tabular font-mono tracking-normal text-ink">{n}</span>
        <span className="h-px w-6 bg-line" />
        {title}
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">{children}</div>
    </motion.fieldset>
  );
}

function PersonForm({ catalog, onAdded }: { catalog: RoleCatalog; onAdded: (p: AddedPerson, password: string) => void }) {
  const [d, setD] = useState<PersonDraft>(EMPTY);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  const set = <K extends DraftField>(k: K, v: PersonDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const roles = catalog.departments.find((x) => x.department === d.department)?.roles ?? [];
  const { problems, body } = checkPerson(d);
  // The API said this address is taken: keep saying so until it changes.
  const takenNow = taken !== null && taken === d.email.trim().toLowerCase();
  if (takenNow) problems.email = "That email already has an account.";
  const show = (k: DraftField) => (sent || (k === "email" && takenNow) ? problems[k] : undefined);
  const aria = (k: DraftField) => ({ "aria-invalid": Boolean(show(k)) || undefined, "aria-describedby": `add-${k}-note` });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
    setError(null);
    const first = ORDER.find((k) => problems[k]);
    if (!body || first) {
      if (first) form.current?.querySelector<HTMLElement>(`#add-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      onAdded(await addPerson(body), body.password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setTaken(body.email.toLowerCase());
        form.current?.querySelector<HTMLElement>("#add-email")?.focus();
      } else if (err instanceof ApiError && (err.status === 0 || err.status === 502)) {
        setError("Can't reach the server. Wait a moment, then add them again.");
      } else if (err instanceof ApiError && err.status === 422 && err.message === "Something went wrong.") {
        // A list of validation errors rather than one sentence: the checks above should have caught it.
        setError("Some details weren't accepted. Check the fields and add them again.");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Group n="01" title="Who they are">
        <div className="sm:col-span-2">
          <Field id="add-name" label="Full name" problem={show("name")}>
            <input
              id="add-name"
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Alex Morgan"
              className={fieldCls}
              {...aria("name")}
            />
          </Field>
        </div>
        <Field id="add-email" label="Work email" problem={show("email")}>
          <input
            id="add-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            maxLength={254}
            value={d.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="alex.morgan@company.com"
            className={fieldCls}
            {...aria("email")}
          />
        </Field>
        <Field
          id="add-password"
          label="Temporary password"
          problem={show("password")}
          hint={`At least ${MIN_TEMP_PASSWORD} characters. They replace it the first time they sign in.`}
        >
          <div className="flex gap-2">
            <input
              id="add-password"
              autoComplete="off"
              spellCheck={false}
              maxLength={200}
              value={d.password}
              onChange={(e) => set("password", e.target.value)}
              className={`min-w-0 font-mono tracking-wide ${fieldCls}`}
              {...aria("password")}
            />
            <button
              type="button"
              onClick={() => set("password", generatePassword())}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-bg active:scale-[0.97]"
            >
              <ArrowsClockwiseIcon size={14} aria-hidden />
              Generate
            </button>
          </div>
        </Field>
      </Group>

      <Group n="02" title="Their role">
        <Field id="add-department" label="Department" problem={show("department")}>
          <Select
            id="add-department"
            value={d.department}
            onChange={(v) => setD((p) => ({ ...p, department: v, jobRole: "" }))}
            invalid={Boolean(show("department"))}
            placeholder="Pick a department"
            options={catalog.departments.map((x) => x.department)}
          />
        </Field>
        <Field id="add-jobRole" label="Job role" problem={show("jobRole")} hint={d.department ? undefined : "Pick a department first."}>
          <Select
            id="add-jobRole"
            value={d.jobRole}
            onChange={(v) => set("jobRole", v)}
            disabled={!d.department}
            invalid={Boolean(show("jobRole"))}
            placeholder="Pick a role"
            options={roles}
          />
        </Field>
        <div className="sm:col-span-2">
          <Segmented<number>
            name="add-level"
            label="Job level"
            options={[1, 2, 3, 4, 5]}
            value={d.jobLevel}
            onChange={(v) => set("jobLevel", v)}
          />
          <p className="mt-1.5 text-sm text-muted">1 is entry level, 5 is senior leadership.</p>
        </div>
      </Group>

      <Group n="03" title="Pay and hours">
        <Field id="add-monthlyIncome" label="Monthly income" problem={show("monthlyIncome")} hint="Gross, in US dollars.">
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              $
            </span>
            <input
              id="add-monthlyIncome"
              inputMode="numeric"
              autoComplete="off"
              value={d.monthlyIncome}
              onChange={(e) => set("monthlyIncome", e.target.value)}
              placeholder="5,000"
              className={`tabular pl-7 pr-16 ${fieldCls}`}
              {...aria("monthlyIncome")}
            />
            <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
              /month
            </span>
          </div>
        </Field>
        <Field id="add-yearsAtCompany" label="Years at the company" problem={show("yearsAtCompany")} hint="0 for a new joiner.">
          <input
            id="add-yearsAtCompany"
            inputMode="numeric"
            autoComplete="off"
            value={d.yearsAtCompany}
            onChange={(e) => set("yearsAtCompany", e.target.value)}
            className={`tabular ${fieldCls}`}
            {...aria("yearsAtCompany")}
          />
        </Field>
        <Segmented<"Yes" | "No">
          name="add-overtime"
          label="Regular overtime"
          options={["No", "Yes"]}
          value={d.overTime}
          onChange={(v) => set("overTime", v)}
        />
        <Segmented<Travel>
          name="add-travel"
          label="Work travel"
          options={TRAVEL}
          value={d.businessTravel}
          onChange={(v) => set("businessTravel", v)}
          render={(v) => TRAVEL_LABEL[v]}
        />
      </Group>

      {error && (
        <p role="alert" className="mt-3 border-l-2 border-signal pl-3 text-sm leading-relaxed text-signal">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[44ch] text-sm text-muted">Anything not asked here starts from the typical colleague in the same role.</p>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 min-w-[10rem] items-center justify-center rounded-full bg-ink px-7 text-sm font-medium text-bg transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-80"
        >
          {busy ? "Adding…" : "Add person"}
        </button>
      </div>
    </form>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-64" />
      ))}
    </div>
  );
}

/** HR adds a person: they're scored right away and get a login on a temporary password. */
export function AddPerson() {
  const reduce = useReducedMotion();
  const { data, error, retry } = useApi(() => getRoles());
  const [added, setAdded] = useState<{ person: AddedPerson; password: string } | null>(null);
  const [round, setRound] = useState(0);

  const rise = (i: number) => ({
    initial: { opacity: 0, transform: `translateY(${reduce ? 0 : 10}px)` },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: 0.5, delay: i * 0.06, ease: EASE_OUT },
  });
  const swap = {
    initial: { opacity: 0, transform: `translateY(${reduce ? 0 : 12}px)` },
    animate: { opacity: 1, transform: "translateY(0px)" },
    exit: { opacity: 0, transition: { duration: 0.15 } },
    transition: { duration: 0.45, ease: EASE_OUT },
  };

  function onAdded(person: AddedPerson, password: string) {
    setAdded({ person, password });
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  function another() {
    setAdded(null);
    setRound((r) => r + 1);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div className={SHELL}>
      <Link
        href="/hr#people"
        className="group -ml-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.97] [@media(hover:hover)]:hover:bg-surface [@media(hover:hover)]:hover:text-ink"
      >
        <ArrowLeftIcon size={14} aria-hidden className="transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:-translate-x-0.5" /> Dashboard
      </Link>

      <div className="mt-8 grid grid-cols-12 gap-y-10 lg:gap-x-16">
        <header className="col-span-12 lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <motion.p {...rise(0)} className="flex items-center gap-2 text-sm text-muted">
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inset-0 rounded-full bg-calm opacity-60 motion-safe:animate-ping" />
                <span className="relative size-2 rounded-full bg-calm" />
              </span>
              New joiner
            </motion.p>
            <motion.h1
              {...rise(1)}
              className="mt-4 text-balance text-[clamp(2.4rem,6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
            >
              Add a person.
            </motion.h1>
            <motion.p {...rise(2)} className="mt-5 max-w-[42ch] text-pretty leading-relaxed text-muted md:text-lg">
              They&apos;re scored right away, from people in the same role, and show up on the dashboard. They set their own
              password the first time they sign in.
            </motion.p>
          </div>
        </header>

        <div className="col-span-12 min-w-0 lg:col-span-8">
          {error ? (
            <ErrorState message={error.message} status={error.status} onRetry={retry} />
          ) : (
            <CrossFade id={data ? "form" : "loading"}>
            {!data ? (
              <FormSkeleton />
            ) : (
            <AnimatePresence mode="wait" initial={false}>
              {added ? (
                <motion.div key="added" {...swap}>
                  <Added person={added.person} password={added.password} onAnother={another} />
                </motion.div>
              ) : (
                <motion.div key={`form-${round}`} {...swap}>
                  <PersonForm catalog={data} onAdded={onAdded} />
                </motion.div>
              )}
            </AnimatePresence>
            )}
            </CrossFade>
          )}
        </div>
      </div>
    </div>
  );
}
