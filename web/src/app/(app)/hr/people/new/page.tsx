import type { Metadata } from "next";
import { AddPerson } from "@/components/hr/onboard/AddPerson";

export const metadata: Metadata = { title: "Add a person" };

export default function AddPersonPage() {
  return <AddPerson />;
}
