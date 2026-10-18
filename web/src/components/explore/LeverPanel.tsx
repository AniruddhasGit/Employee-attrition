"use client";

import type { Levers } from "@/lib/api";
import { int } from "@/lib/format";

type Full = Required<Levers>;

function Segmented<T extends string | number>({
  name,
  label,
  options,
  value,
  onChange,
  render = String,
}: {
  name: string;
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const id = `${name}-${o}`;
          return (
            <label
              key={o}
              htmlFor={id}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-sm transition-colors duration-150 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal ${
                o === value ? "bg-ink text-bg" : "border border-line text-ink-soft hover:bg-bg"
              }`}
            >
              <input
                id={id}
                type="radio"
                name={name}
                className="sr-only"
                checked={o === value}
                onChange={() => onChange(o)}
                aria-label={render(o)}
              />
              {render(o)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between gap-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular text-muted">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--ink)]"
      />
    </div>
  );
}

const TRAVEL: Full["businessTravel"][] = ["Non-Travel", "Travel_Rarely", "Travel_Frequently"];
const TRAVEL_LABEL: Record<Full["businessTravel"], string> = {
  "Non-Travel": "No travel",
  Travel_Rarely: "Rarely",
  Travel_Frequently: "Frequently",
};

export function LeverPanel({ value, onChange }: { value: Full; onChange: (patch: Levers) => void }) {
  return (
    <div className="flex flex-col gap-7">
      <Segmented
        name="overtime"
        label="Overtime"
        options={["Yes", "No"] as Full["overTime"][]}
        value={value.overTime}
        render={(v) => (v === "Yes" ? "Works overtime" : "No overtime")}
        onChange={(v) => onChange({ overTime: v })}
      />
      <Slider
        id="lever-income"
        label="Monthly income"
        value={value.monthlyIncome}
        min={1000}
        max={20000}
        step={100}
        display={`$${int(value.monthlyIncome)}`}
        onChange={(v) => onChange({ monthlyIncome: v })}
      />
      <Segmented
        name="stock"
        label="Stock options"
        options={[0, 1, 2, 3]}
        value={value.stockOptionLevel}
        render={(v) => (v === 0 ? "None" : `Level ${v}`)}
        onChange={(v) => onChange({ stockOptionLevel: v })}
      />
      <Segmented
        name="level"
        label="Job level"
        options={[1, 2, 3, 4, 5]}
        value={value.jobLevel}
        onChange={(v) => onChange({ jobLevel: v })}
      />
      <Slider
        id="lever-training"
        label="Training sessions last year"
        value={value.trainingTimesLastYear}
        min={0}
        max={6}
        display={String(value.trainingTimesLastYear)}
        onChange={(v) => onChange({ trainingTimesLastYear: v })}
      />
      <Segmented
        name="travel"
        label="Business travel"
        options={TRAVEL}
        value={value.businessTravel}
        render={(v) => TRAVEL_LABEL[v]}
        onChange={(v) => onChange({ businessTravel: v })}
      />
      <Slider
        id="lever-promotion"
        label="Years since last promotion"
        value={value.yearsSinceLastPromotion}
        min={0}
        max={15}
        display={String(value.yearsSinceLastPromotion)}
        onChange={(v) => onChange({ yearsSinceLastPromotion: v })}
      />
    </div>
  );
}
