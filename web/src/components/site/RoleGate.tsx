"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shows children only to the right role; everyone else is sent to sign in or to their own home.
 * An account still on HR's temporary password goes to /welcome first (the API refuses it anyway).
 */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const state = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === "signed-out") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (state.status === "signed-in" && state.session.mustChangePassword) router.replace("/welcome");
    else if (state.status === "signed-in" && state.session.role !== role) router.replace(state.session.home);
  }, [state, role, router, pathname]);

  if (state.status === "signed-in" && state.session.role === role && !state.session.mustChangePassword) return <>{children}</>;
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-12 md:px-8 md:pt-16" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-28 rounded-full" />
      <Skeleton className="mt-4 h-12 w-[min(28rem,80%)]" />
      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="mt-6 h-[42dvh]" />
    </div>
  );
}
