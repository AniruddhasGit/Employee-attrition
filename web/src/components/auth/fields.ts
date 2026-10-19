/** Underline inputs shared by the sign-in and first-password forms. */
export const field =
  "peer w-full border-b border-line bg-transparent pb-2.5 pt-1 text-lg outline-none transition-colors duration-150 placeholder:text-mist focus:border-transparent";
// The global :focus-visible ring is unlayered CSS, so only an inline style can drop it; the drawn underline is the focus cue.
export const noRing = { outline: "none" } as const;
// Underline that draws in from the left on focus, over the resting hairline.
export const underline =
  "pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-ink transition-transform duration-300 ease-[var(--ease-out)] peer-focus:scale-x-100";
