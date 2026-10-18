import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowCircle } from "./ArrowCircle";

type Variant = "light" | "dark";

const base =
  "group inline-flex items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 text-sm font-medium whitespace-nowrap transition-transform duration-200 ease-out active:scale-[0.98]";
const variants: Record<Variant, string> = {
  light: "bg-surface text-ink shadow-[0_1px_0_rgb(14_17_22/0.06),0_8px_24px_-12px_rgb(27_36_48/0.35)]",
  dark: "bg-ink text-bg",
};

export function PillButton({
  href,
  children,
  variant = "light",
  ...rest
}: { href?: string; children: ReactNode; variant?: Variant } & Omit<ComponentProps<"button">, "children">) {
  const cls = `${base} ${variants[variant]} ${rest.className ?? ""}`;
  const inner = (
    <>
      <span>{children}</span>
      <ArrowCircle inverted={variant === "dark"} />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button {...rest} className={cls}>
      {inner}
    </button>
  );
}
