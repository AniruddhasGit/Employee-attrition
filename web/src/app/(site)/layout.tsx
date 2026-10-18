import type { ReactNode } from "react";
import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";

/** Public pages: the landing page and sign-in. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
