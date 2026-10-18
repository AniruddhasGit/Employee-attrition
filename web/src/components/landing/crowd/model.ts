/** Crowd layout, neighbour graph and easing helpers for the hero crowd. Allocation happens here, never per frame. */

export const DEPTHS = 4; // far rows are smaller and fainter
export const NEIGHBOURS = 3; // links per figure for the cursor's "teams" lines
export const NONE = 0xffff;

export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export type Crowd = {
  n: number;
  u: Float32Array; // position inside a unit ellipse, -1.2..1.2
  v: Float32Array;
  size: Float32Array; // perspective scale, larger toward the front
  phase: Float32Array; // per-figure sway offset
  depth: Uint8Array; // depth band of each figure
  order: Uint16Array; // indices sorted back-to-front, grouped by depth
  depthEnd: Uint16Array; // exclusive end of each depth group in `order`
  nb: Uint16Array; // NEIGHBOURS nearest neighbours per figure (NONE when too far)
};

/**
 * A sunflower spiral fills the ellipse evenly; each point is then jittered by about half
 * the local spacing so no spiral arms or rows show. The outer fringe is stretched so the
 * crowd thins at its edge instead of stopping.
 */
export function makeCrowd(n: number): Crowd {
  const rand = seeded(1233);
  const u = new Float32Array(n);
  const v = new Float32Array(n);
  const size = new Float32Array(n);
  const phase = new Float32Array(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spacing = Math.sqrt(Math.PI / n);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const fringe = t > 0.78 ? 1 + (t - 0.78) * 1.1 : 1;
    const r = Math.sqrt(t) * fringe;
    const a = i * golden;
    const jitter = spacing * fringe * 0.55;
    u[i] = Math.cos(a) * r + (rand() - 0.5) * 2 * jitter;
    v[i] = Math.sin(a) * r + (rand() - 0.5) * 2 * jitter;
    size[i] = 0.72 + ((v[i] + 1.2) / 2.4) * 0.5 + (rand() - 0.5) * 0.12;
    phase[i] = rand() * Math.PI * 2;
  }
  const order = new Uint16Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => v[a] - v[b]);
  const depthEnd = new Uint16Array(DEPTHS);
  const depth = new Uint8Array(n);
  let start = 0;
  for (let d = 0; d < DEPTHS; d++) {
    depthEnd[d] = Math.round(((d + 1) / DEPTHS) * n);
    for (let k = start; k < depthEnd[d]; k++) depth[order[k]] = d;
    start = depthEnd[d];
  }
  return { n, u, v, size, phase, depth, order, depthEnd, nb: new Uint16Array(n * NEIGHBOURS).fill(NONE) };
}

/**
 * Nearest neighbours in screen space (the ellipse's aspect matters), capped at a few
 * spacings so the links read as small clusters rather than a mesh. O(n^2), run on resize only.
 */
export function linkNeighbours(crowd: Crowd, rx: number, ry: number) {
  const { n, u, v, nb } = crowd;
  const spacing = Math.sqrt((Math.PI * rx * ry) / n);
  const max2 = (spacing * 2.1) ** 2;
  const bestD = new Float32Array(NEIGHBOURS);
  for (let i = 0; i < n; i++) {
    bestD.fill(Infinity);
    const base = i * NEIGHBOURS;
    for (let k = 0; k < NEIGHBOURS; k++) nb[base + k] = NONE;
    const xi = u[i] * rx;
    const yi = v[i] * ry;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = u[j] * rx - xi;
      const dy = v[j] * ry - yi;
      const d2 = dx * dx + dy * dy;
      if (d2 > max2 || d2 >= bestD[NEIGHBOURS - 1]) continue;
      let k = NEIGHBOURS - 1;
      while (k > 0 && bestD[k - 1] > d2) {
        bestD[k] = bestD[k - 1];
        nb[base + k] = nb[base + k - 1];
        k--;
      }
      bestD[k] = d2;
      nb[base + k] = j;
    }
  }
}

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** Strong ease-in-out (cubic) for on-screen travel. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Ease-out (cubic) for things arriving or settling. */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const smooth = (t: number) => t * t * (3 - 2 * t);
/** 0 before a, 1 after b, eased between. */
export const span = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)));
