import type { Metadata } from "next";
import { Dashboard } from "@/components/hr/Dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function HrDashboardPage() {
  return <Dashboard />;
}
