/** Loading placeholder: a soft surface with a slow shimmer (static under reduced motion). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton-shimmer rounded-2xl bg-haze/45 ${className}`} />;
}
