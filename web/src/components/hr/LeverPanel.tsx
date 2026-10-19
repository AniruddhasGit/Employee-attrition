"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Levers } from "@/lib/api";
import { int } from "@/lib/format";

type Full = Required<Levers>;

/** Radio pills; the dark "selected" pill slides between options. */
export function Segmented<T extends string | number>({
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
  const reduce = useReducedMotion();
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-bg p-1">
        {options.map((o) => {
          const id = `${name}-${o}`;
          const on = o === value;
          return (
            <label
              key={o}
              htmlFor={id}
              className={`relative inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-full px-3.5 text-sm transition-[color,transform] duration-150 ease-out active:scale-[0.97] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink sm:min-h-9 sm:min-w-9 ${
                on ? "text-bg" : "text-ink-soft hover:text-ink"
              }`}
            >
              {on && (
                <motion.span
                  layoutId={reduce ? undefined : `seg-${name}`}
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{ type: "spring", duration: 0.35, bounce: 0.12 }}
                />
              )}
              <input
                id={id}
                type="radio"
                name={name}
                className="absolute inset-0 z-10 cursor-pointer appearance-none rounded-full opacity-0"
                checked={on}
                onChange={() => onChange(o)}
                aria-label={render(o)}
              />
              <span className="relative">{render(o)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Native range input, restyled: a filled track up to the thumb, a 24px hit area around a 6px track. */
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
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular rounded-full bg-bg px-2.5 py-0.5 font-medium text-ink">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          // Horizontal 3px / vertical 16px outer radius leaves a 3px round on the 6px content-box track.
          borderRadius: "3px / 16px",
          background: `linear-gradient(to right, var(--ink) 0%, var(--ink) ${fill}%, color-mix(in oklab, var(--haze) 70%, transparent) ${fill}%) content-box`,
        }}
        className="mt-1.5 h-8 w-full cursor-pointer appearance-none bg-transparent py-[13px] [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-surface [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgb(14_17_22/0.25)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 active:[&::-webkit-slider-thumb]:scale-110"
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
    <div className="flex flex-col gap-6">
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
        max={Math.max(25000, value.monthlyIncome)}
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
