import type { Metadata } from "next";
import { CheckInFlow } from "@/components/me/CheckInFlow";

export const metadata: Metadata = { title: "Check-in" };

export default function Page() {
  return <CheckInFlow />;
}
