/** Colour reading for the crowd: resolves tokens to RGB and works out whether the crowd sits on a dark surface. */

let probe: CanvasRenderingContext2D | null = null;

/** Any CSS colour string to [r, g, b, a] (0-255), via a 1x1 canvas so every colour syntax works. */
export function toRGBA(color: string, out: Uint8ClampedArray | number[]) {
  if (!probe) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    probe = c.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return out;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "rgba(0,0,0,0)";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  out[0] = d[0];
  out[1] = d[1];
  out[2] = d[2];
  out[3] = d[3];
  return out;
}

const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Walks up from `el` to the first opaque background and reports whether it is dark. */
export function onDarkSurface(el: Element | null, fallback: boolean) {
  const rgba = [0, 0, 0, 0];
  for (let node = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (!bg || bg === "transparent") continue;
    toRGBA(bg, rgba);
    if (rgba[3] > 128) return luminance(rgba[0], rgba[1], rgba[2]) < 0.42;
  }
  return fallback;
}

/** Lifts a dark token toward white so it still reads on a dark surface. */
export function liftForDark(color: string, amount: number) {
  const rgba = toRGBA(color, [0, 0, 0, 0]);
  if (luminance(rgba[0], rgba[1], rgba[2]) > 0.45) return color;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(rgba[0])}, ${mix(rgba[1])}, ${mix(rgba[2])})`;
}
