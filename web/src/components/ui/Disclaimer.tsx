import { SITE } from "@/lib/site";

export function Disclaimer({ className = "" }: { className?: string }) {
  return <p className={`text-xs text-muted ${className}`}>{SITE.disclaimer}</p>;
}
