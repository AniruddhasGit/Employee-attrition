import type { Metadata } from "next";
import { WelcomeForm } from "@/components/auth/WelcomeForm";

export const metadata: Metadata = { title: "Choose your password" };

/** First sign-in on a temporary password: outside both site and app chrome on purpose. */
export default function WelcomePage() {
  return <WelcomeForm />;
}
