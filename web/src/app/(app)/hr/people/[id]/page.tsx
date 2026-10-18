import type { Metadata } from "next";
import { Suspense } from "react";
import { PersonSkeleton, PersonView } from "@/components/hr/person/PersonView";

export const metadata: Metadata = { title: "Person" };

export default function PersonPage() {
  return (
    <Suspense fallback={<PersonSkeleton />}>
      <PersonView />
    </Suspense>
  );
}
