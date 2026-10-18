"use client";

import type { ReactNode } from "react";

/** Positioned inside a relative chart container; x/y are px numbers or CSS lengths from its top-left. */
export function Tooltip({ x, y, children }: { x: number | string; y: number | string; children: ReactNode }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-50 min-w-36 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[0_10px_30px_-12px_rgb(27_36_48/0.35)]"
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  );
}

export function TipRow({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted">
        {swatch && <span className="size-2 rounded-full" style={{ background: swatch }} />}
        {label}
      </span>
      <span className="tabular font-medium text-ink">{value}</span>
    </div>
  );
}
