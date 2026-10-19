import type { Band } from "./api";

export function pct(p: number, dp = 0): string {
  return `${(p * 100).toFixed(dp)}%`;
}

/** Percentage-point change, e.g. -0.0712 -> "-7 pts". */
export function signedPct(delta: number): string {
  const pts = Math.round(delta * 100);
  if (pts === 0) return "0 pts";
  return `${pts > 0 ? "+" : ""}${pts} pts`;
}

export function money(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function int(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

const BAND_LABELS: Record<Band, string> = { low: "Low", elevated: "Elevated", high: "High" };

export function bandLabel(band: Band): string {
  return BAND_LABELS[band];
}

/** An odds ratio as HR reads it, e.g. 1.84 -> "×1.8 odds"; `tone` says which way it pushes risk. */
export function odds(ratio: number): { text: string; tone: "raises" | "lowers" | "none" } {
  const text = `×${ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1)} odds`;
  return { text, tone: ratio >= 1.05 ? "raises" : ratio <= 0.95 ? "lowers" : "none" };
}
