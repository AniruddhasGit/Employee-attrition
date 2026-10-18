import { About } from "@/components/landing/About";
import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { ContactSection } from "@/components/landing/ContactSection";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { QuestionsCarousel } from "@/components/landing/QuestionsCarousel";

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <HowItWorks />
      <BeforeAfter />
      <QuestionsCarousel />
      <ContactSection />
    </>
  );
}
