"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

/** Shows children only to the right role; everyone else is sent to sign in or to their own home. */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const state = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === "signed-out") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (state.status === "signed-in" && state.session.role !== role) router.replace(state.session.home);
  }, [state, role, router, pathname]);

  if (state.status === "signed-in" && state.session.role === role) return <>{children}</>;
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-28 md:px-8" aria-busy="true">
      <Skeleton className="h-14 w-80" />
      <Skeleton className="mt-10 h-[50dvh]" />
    </div>
  );
}
