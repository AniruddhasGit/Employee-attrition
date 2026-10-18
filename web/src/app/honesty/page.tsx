import type { Metadata } from "next";
import { HonestyView } from "@/components/honesty/HonestyView";

export const metadata: Metadata = { title: "How good is this, honestly?" };

export default function HonestyPage() {
  return <HonestyView />;
}
