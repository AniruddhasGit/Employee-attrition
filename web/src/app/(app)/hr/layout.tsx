import type { ReactNode } from "react";
import { Suspense } from "react";
import { RoleGate } from "@/components/site/RoleGate";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RoleGate role="hr">{children}</RoleGate>
    </Suspense>
  );
}
