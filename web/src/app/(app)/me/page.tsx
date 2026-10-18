import type { Metadata } from "next";
import { Home } from "@/components/me/Home";

export const metadata: Metadata = { title: "Your home" };

export default function Page() {
  return <Home />;
}
