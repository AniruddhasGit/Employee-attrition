import { About } from "@/components/landing/About";
import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { ContactSection } from "@/components/landing/ContactSection";
import { Hero } from "@/components/landing/Hero";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { QuestionsCarousel } from "@/components/landing/QuestionsCarousel";

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <BeforeAfter />
      <LiveDemo />
      <QuestionsCarousel />
      <ContactSection />
    </>
  );
}
