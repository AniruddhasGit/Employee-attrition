import type { ReactNode } from "react";

/** Every route enters with a short rise; a touch of blur hides the crossfade seam. CSS, so no JS wait. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="route-enter">{children}</div>;
}
