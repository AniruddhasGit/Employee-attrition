/** Map a 0..1 value onto the seven-step sequential ramp (CSS variables). */
export function seqColor(t: number): string {
  const i = Math.max(0, Math.min(6, Math.round(t * 6)));
  return `var(--seq-${i})`;
}

/** Text ink that stays readable on a ramp step. */
export function seqInk(t: number): string {
  return Math.round(t * 6) >= 4 ? "var(--seq-ink-hi)" : "var(--ink)";
}

export function linear(d0: number, d1: number, r0: number, r1: number) {
  return (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}
