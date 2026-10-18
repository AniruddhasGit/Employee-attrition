import { ArrowClockwiseIcon, CloudSlashIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

/** Visitor-facing error. Status 0 means the API could not be reached (often a cold start after a quiet spell). */
export function ErrorState({ message, status = 0, onRetry }: { message?: string; status?: number; onRetry?: () => void }) {
  const unreachable = status === 0;
  const Icon = unreachable ? CloudSlashIcon : WarningCircleIcon;
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6 md:flex-row md:items-center md:gap-5 md:p-7">
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
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-bg px-4 text-sm font-medium transition-transform duration-150 ease-out hover:border-ink/30 active:scale-[0.97]"
        >
          <ArrowClockwiseIcon size={14} weight="bold" />
          Reload
        </button>
      )}
    </div>
  );
}
