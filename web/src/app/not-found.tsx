import { PillButton } from "@/components/ui/PillButton";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-[1400px] flex-col justify-end px-4 pb-16 pt-32 md:px-8">
      <p className="text-sm text-muted">404</p>
      <h1 className="mt-2 text-[clamp(3rem,10vw,9rem)] font-semibold leading-[0.9] tracking-[-0.05em]">Nobody here.</h1>
      <p className="mt-6 max-w-[40ch] text-muted">That page doesn&apos;t exist, or it moved when Retain got sign-in.</p>
      <div className="mt-8"><PillButton href="/" variant="dark">Back to the start</PillButton></div>
    </div>
  );
}
