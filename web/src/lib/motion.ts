/** Sanctioned curves (animate skill). Mirrors --ease-out / --ease-in-out in globals.css. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/** Spring presets: `snappy` for controls and chips, `soft` for cards and panels, `settle` for numbers and bars. */
export const SPRING = {
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.6 },
  soft: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
  settle: { type: "spring", stiffness: 120, damping: 22, mass: 1 },
} as const;

/** Shared timing so every list and grid on the site staggers the same way. */
export const STAGGER = 0.05;
