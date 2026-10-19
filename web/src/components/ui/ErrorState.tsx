import { ArrowClockwiseIcon, CloudSlashIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * Visitor-facing error. Status 0 means the API could not be reached (often a cold start after a quiet spell).
 * Enters with a gentle rise out of a soft blur (CSS @starting-style, so no JS); reduced motion only fades.
 */
export function ErrorState({ message, status = 0, onRetry }: { message?: string; status?: number; onRetry?: () => void }) {
  const unreachable = status === 0;
  const Icon = unreachable ? CloudSlashIcon : WarningCircleIcon;
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6 transition-[opacity,translate,filter] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] starting:translate-y-2 starting:opacity-0 starting:blur-[4px] motion-reduce:starting:translate-y-0 motion-reduce:starting:blur-none md:flex-row md:items-center md:gap-5 md:p-7"
    >
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-bg text-ink-soft ring-1 ring-line">
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{unreachable ? "Can't reach the model right now." : "Something went wrong."}</p>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted">
          {unreachable
            ? "The service is waking up after a quiet spell, which can take up to a minute. Reload in a moment."
            : message}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="group inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-bg px-4 text-sm font-medium transition-[scale,border-color] duration-150 ease-out hover:border-ink/30 active:scale-[0.97] motion-reduce:active:scale-100"
        >
          <ArrowClockwiseIcon
            size={14}
            weight="bold"
            className="transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:rotate-180 motion-reduce:group-hover:rotate-0"
          />
          Reload
        </button>
      )}
    </div>
  );
}
