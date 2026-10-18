import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppNav } from "@/components/site/AppNav";

/** Signed-in areas. Each area's own layout checks the role. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<div className="h-16" />}>
        <AppNav />
      </Suspense>
      <main id="main" className="flex-1">
        {children}
      </main>
    </>
  );
}
