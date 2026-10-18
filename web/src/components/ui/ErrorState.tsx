import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6">
      <WarningCircleIcon size={22} className="text-signal" />
      <p className="font-medium">Can&apos;t reach the model right now.</p>
      {message && message !== "Can't reach the model right now." && (
        <p className="text-sm text-muted">{message}</p>
      )}
      <p className="text-sm text-muted">Start the API (make api) or try again in a moment.</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-bg">
          Try again
        </button>
      )}
    </div>
  );
}
