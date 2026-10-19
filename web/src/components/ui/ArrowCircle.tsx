import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";

const arrow =
  "col-start-1 row-start-1 transition-transform duration-[380ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";

/**
 * Circle with an arrow. When its `group` parent is hovered, the arrow slides out through the top-right
 * and a fresh one slides in from the bottom-left. Reduced motion keeps it still.
 */
export function ArrowCircle({ inverted = false, size = 28 }: { inverted?: boolean; size?: number }) {
  const icon = size * 0.5;
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full transition-transform duration-150 ease-out group-active:scale-[0.92] motion-reduce:transition-none motion-reduce:group-active:scale-100 ${
        inverted ? "bg-bg text-ink" : "bg-ink text-bg"
      }`}
    >
      <ArrowUpRightIcon
        size={icon}
        weight="bold"
        className={`${arrow} group-hover:translate-x-[150%] group-hover:-translate-y-[150%] motion-reduce:group-hover:translate-0`}
      />
      <ArrowUpRightIcon
        size={icon}
        weight="bold"
        className={`${arrow} -translate-x-[150%] translate-y-[150%] group-hover:translate-0 motion-reduce:hidden`}
      />
    </span>
  );
}
