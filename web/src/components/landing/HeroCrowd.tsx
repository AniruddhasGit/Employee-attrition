"use client";

import { useEffect, useRef } from "react";

const DESKTOP = 1233; // one figure per person in the demo company
const PHONE = 400;
const DEPTHS = 4; // far rows are smaller and fainter; each depth is one fill call

// Every few seconds a handful of people turn coral and drift out of the crowd, then come back.
const EVERY = 4;
const OUT = 1.6;
const PAUSE = 0.8;
const BACK = 1.2;
const SLOTS = 8;

// Cursor parting: dots inside the radius are pushed aside and spring back (slightly underdamped).
const RADIUS = 80;
const PUSH = 0.6; // share of the gap to the radius edge a dot is pushed
const STIFFNESS = 140;
const DAMPING = 17;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Crowd = {
  n: number;
  u: Float32Array; // position inside a unit ellipse, -1.2..1.2
  v: Float32Array;
  size: Float32Array; // perspective scale, larger toward the front
  phase: Float32Array;
  order: Uint16Array; // indices sorted back-to-front, grouped by depth
  depthEnd: Uint16Array; // exclusive end of each depth group in `order`
};

/**
 * A sunflower spiral fills the ellipse evenly; each point is then jittered by about half
 * the local spacing so no spiral arms or rows show. The outer fringe is stretched so the
 * crowd thins at its edge instead of stopping.
 */
function makeCrowd(n: number): Crowd {
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
  for (let d = 0; d < DEPTHS; d++) depthEnd[d] = Math.round(((d + 1) / DEPTHS) * n);
  return { n, u, v, size, phase, order, depthEnd };
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The hero's crowd: tiny figures (a head over a shoulder arc) standing in a soft ellipse.
 * Every 4 s a few turn coral and drift away, pause, and come back. The cursor parts the crowd.
 * Canvas, DPR-aware, no per-frame allocation. Pauses off-screen and when the tab is hidden.
 * Reduced motion: one still frame.
 */
export function HeroCrowd() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phoneQuery = window.matchMedia("(max-width: 767px)");
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

    let crowd = makeCrowd(phoneQuery.matches ? PHONE : DESKTOP);
    let offX = new Float32Array(crowd.n);
    let offY = new Float32Array(crowd.n);
    let velX = new Float32Array(crowd.n);
    let velY = new Float32Array(crowd.n);
    let slotOf = new Int8Array(crowd.n).fill(-1);
    canvas.dataset.count = String(crowd.n);

    // Drifter pool: who, when they left, where they go, how the path bends.
    const slotWho = new Int32Array(SLOTS).fill(-1);
    const slotStart = new Float32Array(SLOTS);
    const slotDX = new Float32Array(SLOTS);
    const slotDY = new Float32Array(SLOTS);
    const slotBend = new Float32Array(SLOTS);
    const rand = seeded(42);

    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let rx = 0;
    let ry = 0;
    let unit = 1; // figure size, from the crowd's average spacing
    let clock = 0; // seconds of visible animation; stops while paused so timelines never jump
    let nextWave = 1.2;
    let last = 0;
    let raf = 0;
    let running = false;
    let onScreen = true;
    let frames = 0;
    const pointer = { x: -1e4, y: -1e4 };

    // One figure is drawn once into a sprite per colour, then stamped with drawImage:
    // far cheaper per frame than rasterising 2,466 arcs.
    const SPRITE = 4; // sprite box in figure units; the figure sits centred in it
    const baseSprite = document.createElement("canvas");
    const coralSprite = document.createElement("canvas");
    let depthAlpha = [0.36, 0.5, 0.64, 0.8];
    let base = "#ffffff";
    let coral = "#c84f25";
    function readColors() {
      const css = getComputedStyle(document.documentElement);
      coral = css.getPropertyValue("--signal").trim() || coral;
      base = darkQuery.matches ? "#e8ecef" : "#ffffff";
      depthAlpha = darkQuery.matches ? [0.22, 0.32, 0.42, 0.54] : [0.36, 0.5, 0.64, 0.8];
    }

    /** A head over a shoulder dome, centred on the head, in a box of SPRITE figure units. */
    function paintSprite(target: HTMLCanvasElement, color: string, px: number) {
      const box = Math.max(8, Math.ceil(SPRITE * px));
      target.width = box;
      target.height = box;
      const c = target.getContext("2d")!;
      const s = box / SPRITE; // pixels per figure unit
      const x = box / 2;
      const y = box / 2 - s * 0.35;
      const head = s * 0.42;
      const shoulderW = s * 0.88;
      const shoulderH = s * 0.72;
      const foot = y + head + s * 0.2 + shoulderH;
      c.fillStyle = color;
      c.beginPath();
      c.arc(x, y, head, 0, Math.PI * 2);
      c.moveTo(x + shoulderW, foot);
      c.ellipse(x, foot, shoulderW, shoulderH, 0, 0, Math.PI, true);
      c.fill();
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      width = canvas!.clientWidth || rect.width;
      height = canvas!.clientHeight || rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const phone = width < 768;
      cx = width * (phone ? 0.5 : 0.43);
      cy = height * (phone ? 0.3 : 0.41);
      rx = width * (phone ? 0.44 : 0.38);
      ry = height * (phone ? 0.21 : 0.31);
      const want = phoneQuery.matches ? PHONE : DESKTOP;
      if (want !== crowd.n) {
        crowd = makeCrowd(want);
        offX = new Float32Array(want);
        offY = new Float32Array(want);
        velX = new Float32Array(want);
        velY = new Float32Array(want);
        slotOf = new Int8Array(want).fill(-1);
        slotWho.fill(-1);
        canvas!.dataset.count = String(want);
      }
      unit = Math.sqrt((Math.PI * rx * ry) / want) * 0.24;
      // Oversample the sprite so the largest figures stay crisp after scaling.
      paintSprite(baseSprite, base, unit * dpr * 2.4);
      paintSprite(coralSprite, coral, unit * dpr * 2.4);
    }

    function launchWave() {
      const count = 3 + Math.floor(rand() * 4);
      for (let k = 0; k < count; k++) {
        let slot = -1;
        for (let s = 0; s < SLOTS; s++) if (slotWho[s] < 0) { slot = s; break; }
        if (slot < 0) return;
        // Prefer people near the edge, so they visibly leave rather than wade through.
        let who = 0;
        for (let attempt = 0; attempt < 12; attempt++) {
          who = Math.floor(rand() * crowd.n);
          const r = Math.hypot(crowd.u[who], crowd.v[who]);
          if (r > 0.6 && r < 1.05 && slotOf[who] < 0) break;
        }
        const px = crowd.u[who] * rx;
        const py = crowd.v[who] * ry;
        const len = Math.hypot(px, py) || 1;
        const travel = Math.min(rx, ry) * (0.24 + rand() * 0.16);
        if (slotOf[who] >= 0) continue;
        slotWho[slot] = who;
        slotOf[who] = slot;
        slotStart[slot] = clock + k * 0.12;
        slotDX[slot] = (px / len) * travel;
        slotDY[slot] = (py / len) * travel;
        slotBend[slot] = (rand() < 0.5 ? -1 : 1) * travel * (0.25 + rand() * 0.2);
      }
    }

    /** Stamps one figure centred on its head. */
    function figure(sprite: HTMLCanvasElement, x: number, y: number, s: number) {
      const box = unit * SPRITE * s;
      ctx!.drawImage(sprite, x - box / 2, y - box / 2, box, box);
    }

    function step(dt: number) {
      if (clock >= nextWave) {
        launchWave();
        nextWave = clock + EVERY;
      }
      const r2 = RADIUS * RADIUS;
      const { n, u, v } = crowd;
      for (let i = 0; i < n; i++) {
        const bx = cx + u[i] * rx;
        const by = cy + v[i] * ry;
        const dx = bx - pointer.x;
        const dy = by - pointer.y;
        const d2 = dx * dx + dy * dy;
        let tx = 0;
        let ty = 0;
        if (d2 < r2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = 1 - d / RADIUS;
          const push = (RADIUS - d) * PUSH * (1 - f * f * 0.4);
          tx = (dx / d) * push;
          ty = (dy / d) * push;
        }
        velX[i] += ((tx - offX[i]) * STIFFNESS - velX[i] * DAMPING) * dt;
        velY[i] += ((ty - offY[i]) * STIFFNESS - velY[i] * DAMPING) * dt;
        offX[i] += velX[i] * dt;
        offY[i] += velY[i] * dt;
      }
    }

    function drifter(slot: number, out: { x: number; y: number; mix: number }) {
      const t = clock - slotStart[slot];
      if (t < 0) {
        out.x = 0; out.y = 0; out.mix = 0;
        return;
      }
      let p: number;
      let mix: number;
      if (t < OUT) {
        p = easeInOut(t / OUT);
        mix = Math.min(t / 0.4, 1);
      } else if (t < OUT + PAUSE) {
        p = 1;
        mix = 1;
      } else if (t < OUT + PAUSE + BACK) {
        const b = (t - OUT - PAUSE) / BACK;
        p = 1 - easeOut(b);
        mix = 1 - easeOut(b);
      } else {
        slotOf[slotWho[slot]] = -1;
        slotWho[slot] = -1;
        p = 0;
        mix = 0;
      }
      // A sideways bow perpendicular to the exit line, largest mid-flight.
      const bow = Math.sin(p * Math.PI) * slotBend[slot];
      const len = Math.hypot(slotDX[slot], slotDY[slot]) || 1;
      out.x = slotDX[slot] * p + (-slotDY[slot] / len) * bow;
      out.y = slotDY[slot] * p + (slotDX[slot] / len) * bow;
      out.mix = mix;
    }

    const drift = { x: 0, y: 0, mix: 0 };
    const driftX = new Float32Array(SLOTS);
    const driftY = new Float32Array(SLOTS);
    const driftMix = new Float32Array(SLOTS);

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      for (let s = 0; s < SLOTS; s++) {
        if (slotWho[s] < 0) { driftMix[s] = 0; continue; }
        drifter(s, drift);
        driftX[s] = drift.x;
        driftY[s] = drift.y;
        driftMix[s] = drift.mix;
      }
      const { u, v, size, phase, order, depthEnd } = crowd;
      const sway = reduce ? 0 : unit * 0.2;
      let start = 0;
      for (let d = 0; d < DEPTHS; d++) {
        ctx!.globalAlpha = depthAlpha[d];
        for (let k = start; k < depthEnd[d]; k++) {
          const i = order[k];
          let x = cx + u[i] * rx + offX[i] + Math.sin(clock * 0.6 + phase[i]) * sway;
          let y = cy + v[i] * ry + offY[i];
          const s = slotOf[i];
          if (s >= 0) { x += driftX[s]; y += driftY[s]; }
          figure(baseSprite, x, y, size[i]);
        }
        start = depthEnd[d];
      }
      // Coral over the top, faded in and out by each drifter's mix.
      for (let s = 0; s < SLOTS; s++) {
        const i = slotWho[s];
        if (i < 0 || driftMix[s] <= 0) continue;
        ctx!.globalAlpha = driftMix[s];
        const x = cx + u[i] * rx + offX[i] + Math.sin(clock * 0.6 + phase[i]) * sway + driftX[s];
        figure(coralSprite, x, cy + v[i] * ry + offY[i] + driftY[s], size[i] * 1.12);
      }
      ctx!.globalAlpha = 1;
    }

    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      clock += dt;
      step(dt);
      draw();
      raf = requestAnimationFrame(tick);
    }

    function sync() {
      const should = !reduce && onScreen && !document.hidden;
      if (should && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    }

    function still() {
      draw();
      canvas!.dataset.frames = String(++frames);
    }

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * width;
      pointer.y = ((e.clientY - rect.top) / rect.height) * height;
    };
    const onLeave = () => {
      pointer.x = -1e4;
      pointer.y = -1e4;
    };
    const onScheme = () => {
      readColors();
      resize();
      if (reduce) still();
    };
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    // Fires once on observe, which paints the reduced-motion frame.
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) still();
    });

    readColors();
    resize();
    ro.observe(canvas);
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    darkQuery.addEventListener("change", onScheme);
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (fine && !reduce) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    sync();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      darkQuery.removeEventListener("change", onScheme);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} data-hero-crowd aria-hidden className="absolute inset-0 h-full w-full" />;
}
