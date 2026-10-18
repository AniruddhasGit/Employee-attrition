import type { Band } from "@/lib/api";
import { bandLabel } from "@/lib/format";

const STYLE: Record<Band, string> = {
  high: "bg-signal-soft text-signal",
  elevated: "bg-haze/60 text-ink-soft",
  low: "border border-line text-muted",
};

const DOT: Record<Band, string> = {
  high: "bg-signal",
  elevated: "bg-ink-soft/60",
  low: "bg-mist",
};

export function BandChip({ band }: { band: Band }) {
  return (
    <span data-testid="band" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[band]}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${DOT[band]}`} />
      {bandLabel(band)}
    </span>
  );
}
