import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";

/** Black circle with an arrow; rotates when its `group` parent is hovered. */
export function ArrowCircle({ inverted = false, size = 28 }: { inverted?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`inline-grid shrink-0 place-items-center rounded-full transition-transform duration-300 ease-out group-hover:rotate-45 group-active:rotate-45 ${
        inverted ? "bg-bg text-ink" : "bg-ink text-bg"
      }`}
    >
      <ArrowUpRightIcon size={size * 0.5} weight="bold" />
    </span>
  );
}
