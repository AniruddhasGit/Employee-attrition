import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

/** Visitor-facing error. Status 0 means the API could not be reached (often a free-tier cold start). */
export function ErrorState({ message, status = 0, onRetry }: { message?: string; status?: number; onRetry?: () => void }) {
  const unreachable = status === 0;
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6">
      <WarningCircleIcon size={22} className="text-signal" />
      <p className="font-medium">{unreachable ? "Can't reach the model right now." : "Something went wrong."}</p>
      <p className="text-sm text-muted">
        {unreachable
          ? "It runs on free hosting that sleeps when idle, so the first request can take up to a minute. Give it a moment, then reload."
          : message}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-full border border-line px-4 py-1.5 text-sm transition-transform duration-150 ease-out hover:bg-bg active:scale-[0.97]">
          Reload
        </button>
      )}
    </div>
  );
}
