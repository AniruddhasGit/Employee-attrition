"use client";

import { useState } from "react";
import type { Metrics } from "@/lib/api";
import { int, pct } from "@/lib/format";
import { TipRow, Tooltip } from "@/components/charts/Tooltip";

const W = 640;
const H = 300;
const PAD = { l: 36, r: 12, t: 16, b: 30 };
const SERIES = [
  { key: "precision", label: "Precision", color: "var(--series-1)" },
  { key: "recall", label: "Recall", color: "var(--series-2)" },
  { key: "f1", label: "F1", color: "var(--series-3)" },
] as const;

type Point = Metrics["thresholdCurve"][number];

/** Confusion counts on the test set, reconstructed from precision and recall at a threshold. */
function confusion(p: Point, n: number, pos: number) {
  const tp = Math.round(p.recall * pos);
  const flagged = p.precision > 0 ? Math.round(tp / p.precision) : 0;
  const fp = flagged - tp;
  const fn = pos - tp;
  return { tp, fp, fn, tn: n - tp - fp - fn };
}

export function ThresholdExplorer({ m }: { m: Metrics }) {
  const curve = m.thresholdCurve;
  const nearest = curve.reduce((best, p, i) => (Math.abs(p.threshold - m.threshold) < Math.abs(curve[best].threshold - m.threshold) ? i : best), 0);
  const [index, setIndex] = useState(nearest);
  const [hover, setHover] = useState<number | null>(null);
  const p = curve[index];
  const c = confusion(p, m.nTest, m.nTestPos);

  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (t: number) => PAD.l + t * iw;
  const y = (v: number) => PAD.t + ih - v * ih;
  const path = (key: (typeof SERIES)[number]["key"]) => curve.map((q, i) => `${i ? "L" : "M"}${x(q.threshold)},${y(q[key])}`).join(" ");
  const hp = hover !== null ? curve[hover] : null;

  return (
    <div className="grid grid-cols-12 gap-y-10 lg:gap-x-12">
      <div className="col-span-12 lg:col-span-8">
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />{s.label}</span>
          ))}
        </div>
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none"
            role="img"
            aria-label="Precision, recall and F1 on the test set at each threshold"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const t = ((e.clientX - r.left) / r.width * W - PAD.l) / iw;
              const i = curve.reduce((b, q, j) => (Math.abs(q.threshold - t) < Math.abs(curve[b].threshold - t) ? j : b), 0);
              setHover(i);
            }}
            onPointerLeave={() => setHover(null)}
          >
            {[0, 0.5, 1].map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
                <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[10px]">{v}</text>
              </g>
            ))}
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <text key={v} x={x(v)} y={H - 8} textAnchor="middle" className="fill-muted text-[10px]">{pct(v)}</text>
            ))}
            <line x1={x(m.threshold)} x2={x(m.threshold)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--muted)" strokeDasharray="2 4" />
            <line x1={x(p.threshold)} x2={x(p.threshold)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--ink)" strokeWidth="1.5" />
            {SERIES.map((s) => (
              <g key={s.key}>
                <path d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(p.threshold)} cy={y(p[s.key])} r="5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
              </g>
            ))}
            {hp && <line x1={x(hp.threshold)} x2={x(hp.threshold)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--ink)" strokeOpacity="0.25" />}
          </svg>
          {hp && (
            <Tooltip x={`${(x(hp.threshold) / W) * 100}%`} y={`${(PAD.t / H) * 100}%`}>
              <p className="mb-1.5 font-medium text-ink">Threshold {pct(hp.threshold)}</p>
              {SERIES.map((s) => <TipRow key={s.key} label={s.label} value={hp[s.key].toFixed(2)} swatch={s.color} />)}
            </Tooltip>
          )}
        </div>
        <label htmlFor="threshold" className="mt-6 flex items-baseline justify-between gap-4">
          <span className="font-medium">Decision threshold</span>
          <span className="tabular text-sm text-muted">{pct(p.threshold)} (the model uses {pct(m.threshold)})</span>
        </label>
        <input
          id="threshold"
          type="range"
          min={curve[0].threshold}
          max={curve[curve.length - 1].threshold}
          step={0.05}
          value={p.threshold}
          onChange={(e) => {
            const v = Number(e.target.value);
            setIndex(curve.reduce((b, q, j) => (Math.abs(q.threshold - v) < Math.abs(curve[b].threshold - v) ? j : b), 0));
          }}
          className="mt-3 w-full accent-[var(--ink)]"
        />
      </div>

      <div className="col-span-12 lg:col-span-4">
        <p className="text-sm text-muted">At {pct(p.threshold)}, on {m.nTest} people the model never saw</p>
        <dl className="mt-4 grid grid-cols-2 gap-4">
          <div><dt className="text-xs text-muted">Precision</dt><dd className="tabular text-3xl font-semibold">{pct(p.precision)}</dd></div>
          <div><dt className="text-xs text-muted">Recall</dt><dd data-testid="threshold-recall" className="tabular text-3xl font-semibold">{pct(p.recall)}</dd></div>
        </dl>
        <table className="mt-6 w-full text-sm">
          <caption className="mb-2 text-left text-xs text-muted">Who gets flagged</caption>
          <thead>
            <tr className="text-xs text-muted"><th /><th className="pb-2 text-right font-normal">Flagged</th><th className="pb-2 text-right font-normal">Not flagged</th></tr>
          </thead>
          <tbody className="tabular">
            <tr className="border-t border-line"><th className="py-2 text-left font-normal">Left</th><td className="text-right font-medium">{int(c.tp)}</td><td className="text-right">{int(c.fn)}</td></tr>
            <tr className="border-t border-line"><th className="py-2 text-left font-normal">Stayed</th><td className="text-right">{int(c.fp)}</td><td className="text-right">{int(c.tn)}</td></tr>
          </tbody>
        </table>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Lower the threshold and you catch more leavers, but flag more people who would have
          stayed. There is no free setting, only a trade-off to choose on purpose.
        </p>
      </div>
    </div>
  );
}
