/** Simple geometric mark: an open ring (people) with one dot leaving it. */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <circle cx="9" cy="10" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="30 9.3" />
      <circle cx="17" cy="4" r="1.75" fill="var(--signal)" />
    </svg>
  );
}
