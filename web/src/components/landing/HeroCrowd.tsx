"use client";

import { useEffect, useRef } from "react";
import { liftForDark, onDarkSurface } from "./crowd/colors";
import {
  type Crowd,
  DEPTHS,
  NEIGHBOURS,
  NONE,
  clamp01,
  easeInOut,
  easeOut,
  linkNeighbours,
  makeCrowd,
  seeded,
  span,
} from "./crowd/model";

const DESKTOP = 1233; // one figure per person in the demo company
const PHONE = 400;
const AREA_PER_FIGURE = 200; // px² of ellipse per figure; small containers get fewer people

// Ambient life: a slow flow field sways every figure; the whole crowd breathes and drifts.
const SWAY_X = 2.6; // px at size 1
const SWAY_Y = 1.3;
const BREATH = 0.012; // share of the ellipse
const BREATH_PERIOD = 8.5;

// Check-in wave: a soft ring sweeps the crowd; people it passes brighten, then ease back.
const RING_EVERY = 6; // + up to 2 s
const RING_DURATION = 2.5;
const RINGS = 4;

// Predict -> act -> retain. Timeline in seconds from the moment a person is flagged.
const SLOTS = 18;
const TURN = 0.45; // turns coral in place
const OUT = 1.8; // drifts out along a curve
const HELPER_IN = 0.8; // someone nearby turns calm blue...
const LINE_START = 1.1; // ...and reaches out
const LINE_REACH = 0.55;
const CAUGHT = LINE_START + LINE_REACH;
const HOLD = 0.35;
const RETURN = 1.7;
const BACK_HOME = TURN + OUT + HOLD + RETURN; // 4.3
const CALM_FADE = 1.2;
const RETAINED_END = BACK_HOME + CALM_FADE;
const LOST_OUT = 3.2; // drifts past the edge and fades
const LOST_GONE = TURN + LOST_OUT;
const ARRIVE_GAP = 0.5;
const ARRIVE = 1.0; // a new person fades in at the empty spot
const LOST_END = LOST_GONE + ARRIVE_GAP + ARRIVE;
const KEEP_SHARE = 0.67;
const TRAIL = 8;
const TRAIL_STEP = 0.045;

// Cursor as a lantern: brightens within LANTERN px, links neighbours, parts the crowd with a spring.
const LANTERN = 120;
const PART = 80;
const PUSH = 0.6;
const STIFFNESS = 140;
const DAMPING = 17;

const LIT_GROW = 0.2; // a lit figure is up to this much larger

const SPRITE = 4; // sprite box in figure units; the figure sits centred in it
const TAU = Math.PI * 2;

/**
 * The hero's crowd, telling the product's story on one canvas: everyone sways gently,
 * check-in waves of light sweep through, people flagged at risk turn coral and drift out,
 * and most are reached by a calm-blue line from someone nearby and brought back. The cursor
 * is a lantern. Sizes itself to its parent; reads its surface so it works on dark panels.
 * DPR-aware (capped at 2), no per-frame allocation, pauses off-screen and in hidden tabs.
 * Reduced motion: one calm still frame, no pointer effects.
 */
export function HeroCrowd() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const host = canvas.parentElement ?? canvas;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phoneQuery = window.matchMedia("(max-width: 767px)");
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const rand = seeded(42);

    // Per-figure state, reallocated only when the head count changes.
    let crowd: Crowd = makeCrowd(phoneQuery.matches ? PHONE : DESKTOP);
    let offX = new Float32Array(crowd.n); // cursor parting spring
    let offY = new Float32Array(crowd.n);
    let velX = new Float32Array(crowd.n);
    let velY = new Float32Array(crowd.n);
    let posX = new Float32Array(crowd.n); // where each figure is drawn this frame
    let posY = new Float32Array(crowd.n);
    let lit = new Float32Array(crowd.n); // 0..1 brightness from waves and the lantern
    let near = new Float32Array(crowd.n); // 0..1 closeness to the lantern
    let inLantern = new Uint16Array(crowd.n);
    let lanternCount = 0;
    let slotOf = new Int8Array(crowd.n).fill(-1);
    let helping = new Int8Array(crowd.n).fill(-1);
    let linkedAspect = 0;

    // Leaver pool.
    const slotWho = new Int32Array(SLOTS).fill(-1);
    const slotHelper = new Int32Array(SLOTS).fill(-1);
    const slotKeep = new Uint8Array(SLOTS);
    const slotStart = new Float32Array(SLOTS);
    const slotEX = new Float32Array(SLOTS); // path end, relative to home
    const slotEY = new Float32Array(SLOTS);
    const slotCX = new Float32Array(SLOTS); // quadratic control point, relative to home
    const slotCY = new Float32Array(SLOTS);

    // Ring pool.
    const ringX = new Float32Array(RINGS);
    const ringY = new Float32Array(RINGS);
    const ringStart = new Float32Array(RINGS).fill(-1e3);
    const ringDur = new Float32Array(RINGS).fill(1);
    const ringMax = new Float32Array(RINGS);
    const ringBand = new Float32Array(RINGS);
    const ringStrength = new Float32Array(RINGS);
    const ringR = new Float32Array(RINGS); // current radius, -1 when idle
    const ringFade = new Float32Array(RINGS);
    let nextRing = 1.6;

    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let rx = 0;
    let ry = 0;
    let squash = 1; // ry / rx: rings follow the crowd's ground plane
    let phone = false;
    let unit = 1; // figure size, from the crowd's average spacing
    let clock = 0; // seconds of visible animation; stops while paused so timelines never jump
    let nextWave = 1.2;
    let last = 0;
    let raf = 0;
    let running = false;
    let onScreen = true;
    let frames = 0;
    // Crowd frame of this tick (breath and drift applied).
    let fx = 0;
    let fy = 0;
    let frx = 0;
    let fry = 0;
    const pointer = { x: -1e4, y: -1e4, amt: 0, inside: false };

    // Each figure is drawn once into a sprite per colour, then stamped with drawImage.
    const baseSprite = document.createElement("canvas");
    const coralSprite = document.createElement("canvas");
    const calmSprite = document.createElement("canvas");
    const haloSprite = document.createElement("canvas");
    let baseImg: CanvasImageSource = baseSprite;
    let baseBitmap: ImageBitmap | null = null;
    let spriteGen = 0;
    let disposed = false;
    const depthAlpha = new Float32Array(DEPTHS);
    let base = "#ffffff";
    let coral = "#c84f25";
    let calm = "#4f6f8c";
    let dark = false;

    function readColors() {
      const css = getComputedStyle(document.documentElement);
      dark = onDarkSurface(host, darkQuery.matches);
      coral = css.getPropertyValue("--signal").trim() || coral;
      calm = css.getPropertyValue("--calm").trim() || calm;
      if (dark) {
        base = css.getPropertyValue("--night-ink").trim() || "#e8ecef";
        calm = liftForDark(calm, 0.42);
        depthAlpha.set([0.22, 0.32, 0.42, 0.54]);
      } else {
        base = "#ffffff";
        depthAlpha.set([0.36, 0.5, 0.64, 0.8]);
      }
    }

    /** A head over a shoulder dome, centred on the head, in a box of SPRITE figure units. */
    function paintSprite(target: HTMLCanvasElement, color: string, px: number) {
      const box = Math.max(8, Math.ceil(SPRITE * px));
      target.width = box;
      target.height = box;
      const c = target.getContext("2d")!;
      const s = box / SPRITE;
      const x = box / 2;
      const y = box / 2 - s * 0.35;
      const head = s * 0.42;
      const shoulderW = s * 0.88;
      const shoulderH = s * 0.72;
      const foot = y + head + s * 0.2 + shoulderH;
      c.fillStyle = color;
      c.beginPath();
      c.arc(x, y, head, 0, TAU);
      c.moveTo(x + shoulderW, foot);
      c.ellipse(x, foot, shoulderW, shoulderH, 0, 0, Math.PI, true);
      c.fill();
    }

    /** A soft round light, used for the lantern, lit figures and arrivals. */
    function paintHalo(color: string) {
      const box = 64;
      haloSprite.width = box;
      haloSprite.height = box;
      const c = haloSprite.getContext("2d")!;
      const g = c.createRadialGradient(box / 2, box / 2, 0, box / 2, box / 2, box / 2);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.globalAlpha = 1;
      c.fillStyle = g;
      c.fillRect(0, 0, box, box);
      // Feather the falloff so the halo has no visible edge.
      c.globalCompositeOperation = "destination-in";
      const f = c.createRadialGradient(box / 2, box / 2, 0, box / 2, box / 2, box / 2);
      f.addColorStop(0, "rgba(0,0,0,1)");
      f.addColorStop(0.5, "rgba(0,0,0,0.45)");
      f.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = f;
      c.fillRect(0, 0, box, box);
      c.globalCompositeOperation = "source-over";
    }

    function allocate(n: number) {
      crowd = makeCrowd(n);
      offX = new Float32Array(n);
      offY = new Float32Array(n);
      velX = new Float32Array(n);
      velY = new Float32Array(n);
      posX = new Float32Array(n);
      posY = new Float32Array(n);
      lit = new Float32Array(n);
      near = new Float32Array(n);
      inLantern = new Uint16Array(n);
      lanternCount = 0;
      slotOf = new Int8Array(n).fill(-1);
      helping = new Int8Array(n).fill(-1);
      slotWho.fill(-1);
      slotHelper.fill(-1);
      linkedAspect = 0;
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = host.clientWidth || canvas!.clientWidth;
      height = host.clientHeight || canvas!.clientHeight;
      if (!width || !height) return;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      phone = width < 768;
      cx = width * (phone ? 0.5 : 0.43);
      cy = height * (phone ? 0.3 : 0.41);
      rx = width * (phone ? 0.44 : 0.38);
      ry = height * (phone ? 0.21 : 0.31);
      squash = ry / rx;
      const cap = phoneQuery.matches ? PHONE : DESKTOP;
      const fit = Math.floor((Math.PI * rx * ry) / AREA_PER_FIGURE);
      const want = Math.max(60, Math.min(cap, fit));
      if (want !== crowd.n) allocate(want);
      canvas!.dataset.count = String(crowd.n);
      const aspect = ry / rx;
      if (!reduce && Math.abs(aspect - linkedAspect) > 0.04 * aspect) {
        linkNeighbours(crowd, rx, ry);
        linkedAspect = aspect;
      }
      unit = Math.sqrt((Math.PI * rx * ry) / crowd.n) * 0.24;
      // Oversample the sprite so the largest (lit, flagged) figures stay crisp after scaling.
      const px = unit * dpr * 2.6;
      paintSprite(baseSprite, base, px);
      paintSprite(coralSprite, coral, px);
      paintSprite(calmSprite, calm, px);
      paintHalo(base);
      // The base figure is stamped ~1,200 times a frame; an ImageBitmap stamps about 30%
      // cheaper than a canvas. Use the canvas until the bitmap is ready.
      baseImg = baseSprite;
      const gen = ++spriteGen;
      if (!reduce && typeof createImageBitmap === "function") {
        createImageBitmap(baseSprite).then(
          (bmp) => {
            if (gen !== spriteGen || disposed) return bmp.close();
            if (baseBitmap) baseBitmap.close();
            baseBitmap = bmp;
            baseImg = bmp;
          },
          () => {},
        );
      }
    }

    // ---------- Story events ----------

    function launchRing(x: number, y: number, max: number, dur: number, band: number, strength: number) {
      let slot = 0;
      for (let r = 1; r < RINGS; r++) if (ringStart[r] < ringStart[slot]) slot = r;
      ringX[slot] = x;
      ringY[slot] = y;
      ringStart[slot] = clock;
      ringDur[slot] = dur;
      ringMax[slot] = max;
      ringBand[slot] = band;
      ringStrength[slot] = strength;
    }

    function checkInWave() {
      // Start inside the crowd, away from the very edge.
      const i = Math.floor(rand() * crowd.n);
      const ou = crowd.u[i] * 0.7;
      const ov = crowd.v[i] * 0.7;
      const x = cx + ou * rx;
      const y = cy + ov * ry;
      const reach = rx * (1.25 + Math.hypot(ou, ov));
      launchRing(x, y, reach, RING_DURATION, Math.max(30, unit * 11), 1);
    }

    function freeSlot() {
      for (let s = 0; s < SLOTS; s++) if (slotWho[s] < 0) return s;
      return -1;
    }

    /** The nearest free figure to a point, for HR stepping in. */
    function nearestFree(x: number, y: number, not: number) {
      const { n, u, v } = crowd;
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < n; j++) {
        if (j === not || slotOf[j] >= 0 || helping[j] >= 0) continue;
        const dx = u[j] * rx - x;
        const dy = v[j] * ry - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      return best;
    }

    function flagWave() {
      const count = phone ? 2 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 4);
      let delay = 0;
      for (let k = 0; k < count; k++) {
        const slot = freeSlot();
        if (slot < 0) return;
        // Prefer people near the edge, so they visibly leave rather than wade through.
        let who = -1;
        for (let attempt = 0; attempt < 16; attempt++) {
          const c = Math.floor(rand() * crowd.n);
          if (slotOf[c] >= 0 || helping[c] >= 0) continue;
          who = c;
          const r = Math.hypot(crowd.u[c], crowd.v[c]);
          if (r > 0.55 && r < 1.05) break;
        }
        if (who < 0) continue;
        const hx = crowd.u[who] * rx;
        const hy = crowd.v[who] * ry;
        const len = Math.hypot(hx, hy) || 1;
        const turn = (rand() - 0.5) * 0.7;
        const dx = (hx / len) * Math.cos(turn) - (hy / len) * Math.sin(turn);
        const dy = (hx / len) * Math.sin(turn) + (hy / len) * Math.cos(turn);
        const keep = rand() < KEEP_SHARE;
        const travel = keep
          ? Math.max(28, Math.min(rx, ry) * (0.38 + rand() * 0.2))
          : Math.max(width, height) * (0.5 + rand() * 0.15);
        const bend = (rand() < 0.5 ? -1 : 1) * travel * (0.18 + rand() * 0.18);
        slotWho[slot] = who;
        slotOf[who] = slot;
        slotKeep[slot] = keep ? 1 : 0;
        slotStart[slot] = clock + delay;
        slotEX[slot] = dx * travel;
        slotEY[slot] = dy * travel;
        slotCX[slot] = dx * travel * 0.5 - dy * bend;
        slotCY[slot] = dy * travel * 0.5 + dx * bend;
        slotHelper[slot] = -1;
        if (keep) {
          // Someone a little further into the crowd, along the way they came from.
          const back = Math.max(unit * 6, 22) + rand() * unit * 6;
          const h = nearestFree(hx - dx * back + dy * back * 0.4, hy - dy * back - dx * back * 0.4, who);
          if (h >= 0) {
            slotHelper[slot] = h;
            helping[h] = slot;
          } else {
            slotKeep[slot] = 0;
          }
        }
        delay += 0.18 + rand() * 0.22;
      }
    }

    function release(s: number) {
      const i = slotWho[s];
      if (i >= 0) slotOf[i] = -1;
      const h = slotHelper[s];
      if (h >= 0) helping[h] = -1;
      slotWho[s] = -1;
      slotHelper[s] = -1;
    }

    /** Path progress (0 home, 1 at the end of the path) for slot s at its local time t. */
    function progress(s: number, t: number) {
      if (t <= TURN) return 0;
      if (slotKeep[s]) {
        if (t < TURN + OUT) return easeInOut((t - TURN) / OUT);
        if (t < TURN + OUT + HOLD) return 1;
        if (t < BACK_HOME) return 1 - easeInOut((t - TURN - OUT - HOLD) / RETURN);
        return 0;
      }
      const x = clamp01((t - TURN) / LOST_OUT);
      return Math.pow(x, 1.6);
    }

    // Scratch for path points (no allocation in the frame loop).
    let px = 0;
    let py = 0;
    function pathAt(s: number, p: number) {
      const a = 2 * (1 - p) * p;
      const b = p * p;
      px = a * slotCX[s] + b * slotEX[s];
      py = a * slotCY[s] + b * slotEY[s];
    }

    // ---------- Simulation ----------

    function step(dt: number) {
      if (clock >= nextWave) {
        flagWave();
        nextWave = clock + (phone ? 3.6 : 3.2) + rand() * 1.4;
      }
      if (clock >= nextRing) {
        checkInWave();
        nextRing = clock + RING_EVERY + rand() * 2;
      }
      for (let s = 0; s < SLOTS; s++) {
        if (slotWho[s] < 0) continue;
        const t = clock - slotStart[s];
        if (t > (slotKeep[s] ? RETAINED_END : LOST_END)) release(s);
      }

      // Active rings: radius now, and how strongly they still glow.
      for (let r = 0; r < RINGS; r++) {
        const p = (clock - ringStart[r]) / ringDur[r];
        if (p < 0 || p >= 1) {
          ringR[r] = -1;
          continue;
        }
        ringR[r] = ringMax[r] * (1 - (1 - p) * (1 - p));
        ringFade[r] = ringStrength[r] * (1 - p * 0.55);
      }

      // The crowd frame breathes and drifts on long, unrelated periods.
      const breath = 1 + Math.sin((clock * TAU) / BREATH_PERIOD) * BREATH;
      fx = cx + Math.sin((clock * TAU) / 23) * rx * 0.012;
      fy = cy + Math.sin((clock * TAU) / 17 + 1.3) * ry * 0.018;
      frx = rx * breath;
      fry = ry * breath;

      const towards = pointer.inside ? 1 : 0;
      pointer.amt += (towards - pointer.amt) * Math.min(1, dt * (towards ? 6 : 3));
      const lanternOn = pointer.amt > 0.01;
      const part2 = PART * PART;
      const lantern2 = LANTERN * LANTERN;
      const up = Math.min(1, dt * 16);
      const down = Math.min(1, dt * 3);
      const { n, u, v, size, phase } = crowd;
      const w1 = clock * (TAU / 6.4);
      const w2 = clock * (TAU / 9.3);
      const w3 = clock * (TAU / 7.7);
      lanternCount = 0;

      for (let i = 0; i < n; i++) {
        const bx = fx + u[i] * frx;
        const by = fy + v[i] * fry;

        // Lantern: closeness, parting target.
        let tx = 0;
        let ty = 0;
        let target = 0;
        near[i] = 0;
        if (lanternOn) {
          const dx = bx - pointer.x;
          const dy = by - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < lantern2) {
            const d = Math.sqrt(d2);
            const c = (1 - d / LANTERN) * pointer.amt;
            near[i] = c;
            inLantern[lanternCount++] = i;
            target = c * c * 0.9;
            if (d2 < part2 && d > 0.1 && pointer.inside) {
              const f = 1 - d / PART;
              const push = (PART - d) * PUSH * (1 - f * f * 0.4);
              tx = (dx / d) * push;
              ty = (dy / d) * push;
            }
          }
        }
        velX[i] += ((tx - offX[i]) * STIFFNESS - velX[i] * DAMPING) * dt;
        velY[i] += ((ty - offY[i]) * STIFFNESS - velY[i] * DAMPING) * dt;
        offX[i] += velX[i] * dt;
        offY[i] += velY[i] * dt;

        // Check-in rings: a soft band around the current radius.
        for (let r = 0; r < RINGS; r++) {
          const R = ringR[r];
          if (R < 0) continue;
          const dx = bx - ringX[r];
          const dy = (by - ringY[r]) / squash;
          const band = ringBand[r];
          const diff = Math.abs(Math.sqrt(dx * dx + dy * dy) - R);
          if (diff < band) {
            const g = 1 - diff / band;
            const glow = g * g * (3 - 2 * g) * ringFade[r];
            if (glow > target) target = glow;
          }
        }
        if (slotOf[i] >= 0) target = 0;
        lit[i] += (target - lit[i]) * (target > lit[i] ? up : down);

        // A slow flow field: neighbours sway together, each with its own lag.
        const ph = phase[i];
        const sx = Math.sin(w1 + u[i] * 2.3 + v[i] * 0.9 + ph * 0.35) * 0.65 + Math.sin(w2 + ph) * 0.35;
        const sy = Math.sin(w3 + v[i] * 2.1 - u[i] * 0.7 + ph * 0.5);
        const s = size[i];
        posX[i] = bx + offX[i] + sx * SWAY_X * s;
        posY[i] = by + offY[i] + sy * SWAY_Y * s - lit[i] * unit * 0.35;
      }
    }

    /** Positions only, no motion: the reduced-motion frame. */
    function settle() {
      const { n, u, v } = crowd;
      fx = cx;
      fy = cy;
      frx = rx;
      fry = ry;
      for (let i = 0; i < n; i++) {
        posX[i] = cx + u[i] * rx;
        posY[i] = cy + v[i] * ry;
        lit[i] = 0;
      }
      lanternCount = 0;
      for (let r = 0; r < RINGS; r++) ringR[r] = -1;
    }

    // ---------- Drawing ----------

    function figure(sprite: CanvasImageSource, x: number, y: number, s: number) {
      const box = unit * SPRITE * s;
      ctx!.drawImage(sprite, x - box / 2, y - box / 2, box, box);
    }

    function halo(x: number, y: number, r: number) {
      ctx!.drawImage(haloSprite, x - r, y - r, r * 2, r * 2);
    }

    function drawRings() {
      const c = ctx!;
      c.strokeStyle = base;
      for (let r = 0; r < RINGS; r++) {
        const R = ringR[r];
        if (R < 1) continue;
        const p = (clock - ringStart[r]) / ringDur[r];
        const fade = (1 - p) * (1 - p) * ringStrength[r];
        c.beginPath();
        c.ellipse(ringX[r], ringY[r], R, R * squash, 0, 0, TAU);
        c.globalAlpha = (dark ? 0.22 : 0.4) * fade;
        c.lineWidth = 1;
        c.stroke();
      }
    }

    function drawLanternLines() {
      if (lanternCount === 0 || phone) return;
      const c = ctx!;
      const { nb } = crowd;
      c.strokeStyle = base;
      c.lineWidth = 0.75;
      for (let b = 1; b <= 3; b++) {
        const lo = (b - 1) / 3;
        const hi = b / 3;
        c.beginPath();
        let any = false;
        for (let k = 0; k < lanternCount; k++) {
          const i = inLantern[k];
          const ci = near[i];
          for (let e = 0; e < NEIGHBOURS; e++) {
            const j = nb[i * NEIGHBOURS + e];
            if (j === NONE) continue;
            const cj = near[j];
            const m = ci < cj ? ci : cj;
            if (m <= lo || m > hi) continue;
            c.moveTo(posX[i], posY[i] + unit * 0.5);
            c.lineTo(posX[j], posY[j] + unit * 0.5);
            any = true;
          }
        }
        if (!any) continue;
        c.globalAlpha = (dark ? 0.32 : 0.55) * hi;
        c.stroke();
      }
    }

    function drawTrail(s: number, t: number, i: number, color: string, strength: number) {
      const c = ctx!;
      const p0 = progress(s, t);
      const ox = posX[i];
      const oy = posY[i] + unit * 0.55;
      pathAt(s, p0);
      let lx = ox + px;
      let ly = oy + py;
      let lp = p0;
      c.strokeStyle = color;
      c.lineCap = "round";
      const steps = phone ? 5 : TRAIL;
      for (let k = 1; k <= steps; k++) {
        const pk = progress(s, t - k * TRAIL_STEP);
        if (Math.abs(pk - lp) < 0.0015) break;
        pathAt(s, pk);
        const nx = ox + px;
        const ny = oy + py;
        const f = 1 - k / (steps + 1);
        c.globalAlpha = strength * f * f;
        c.lineWidth = Math.max(0.6, unit * 0.95 * f);
        c.beginPath();
        c.moveTo(lx, ly);
        c.lineTo(nx, ny);
        c.stroke();
        lx = nx;
        ly = ny;
        lp = pk;
      }
    }

    function drawSlots() {
      const c = ctx!;
      const { size, depth } = crowd;
      for (let s = 0; s < SLOTS; s++) {
        const i = slotWho[s];
        if (i < 0) continue;
        const t = clock - slotStart[s];
        const da = depthAlpha[depth[i]];
        const sz = size[i];
        if (t < 0) {
          c.globalAlpha = da;
          figure(baseImg, posX[i], posY[i], sz);
          continue;
        }
        const p = progress(s, t);
        pathAt(s, p);
        const x = posX[i] + px;
        const y = posY[i] + py;

        if (slotKeep[s]) {
          const coralMix = span(t, 0, TURN);
          const calmMix = span(t, CAUGHT, TURN + OUT) * (1 - span(t, BACK_HOME, RETAINED_END));
          const flagged = Math.max(coralMix * (1 - span(t, BACK_HOME, RETAINED_END)), calmMix);
          const scale = sz * (1 + 0.22 * flagged);

          // Trails: coral on the way out, faint calm on the way back.
          if (t > TURN && t < TURN + OUT + 0.3) drawTrail(s, t, i, coral, 0.55);
          else if (t > TURN + OUT + HOLD && t < BACK_HOME + 0.3) drawTrail(s, t, i, calm, 0.3);

          // HR stepping in: the helper turns calm, a thin line reaches the leaver and stays until home.
          const h = slotHelper[s];
          if (h >= 0) {
            const helperMix = span(t, HELPER_IN, HELPER_IN + 0.35) * (1 - span(t, BACK_HOME - 0.4, BACK_HOME + 0.4));
            const reach = easeOut(clamp01((t - LINE_START) / LINE_REACH));
            const lineAlpha = span(t, LINE_START, LINE_START + 0.15) * (1 - span(t, BACK_HOME - 0.9, BACK_HOME));
            const hx = posX[h];
            const hy = posY[h] + unit * 0.5;
            if (reach > 0 && lineAlpha > 0.01) {
              const tx = x;
              const ty = y + unit * 0.5;
              // A slight bow, split at `reach` so the line grows along its own curve.
              const mx = (hx + tx) / 2 + (ty - hy) * 0.18;
              const my = (hy + ty) / 2 - (tx - hx) * 0.18;
              const q1x = hx + (mx - hx) * reach;
              const q1y = hy + (my - hy) * reach;
              const a = 1 - reach;
              const ex = a * a * hx + 2 * a * reach * mx + reach * reach * tx;
              const ey = a * a * hy + 2 * a * reach * my + reach * reach * ty;
              c.strokeStyle = calm;
              c.lineWidth = phone ? 1 : 1.25;
              c.lineCap = "round";
              c.globalAlpha = 0.9 * lineAlpha;
              c.beginPath();
              c.moveTo(hx, hy);
              c.quadraticCurveTo(q1x, q1y, ex, ey);
              c.stroke();
              if (reach < 1) {
                c.fillStyle = calm;
                c.beginPath();
                c.arc(ex, ey, phone ? 1.4 : 1.8, 0, TAU);
                c.fill();
              }
            }
            if (helperMix > 0.01) {
              c.globalAlpha = helperMix;
              figure(calmSprite, posX[h], posY[h], size[h] * (1 + 0.08 * helperMix));
            }
          }

          c.globalAlpha = da;
          figure(baseImg, x, y, scale);
          const coralOn = coralMix * (1 - calmMix);
          if (coralOn > 0.01) {
            c.globalAlpha = coralOn;
            figure(coralSprite, x, y, scale);
          }
          if (calmMix > 0.01) {
            c.globalAlpha = calmMix;
            figure(calmSprite, x, y, scale);
          }
        } else if (t < LOST_GONE) {
          const coralMix = span(t, 0, TURN);
          const x01 = clamp01((t - TURN) / LOST_OUT);
          const fade = 1 - span(x01, 0.45, 1);
          if (t > TURN) drawTrail(s, t, i, coral, 0.55 * fade);
          const scale = sz * (1 + 0.22 * coralMix);
          c.globalAlpha = da * (1 - coralMix);
          figure(baseImg, x, y, scale);
          c.globalAlpha = coralMix * fade;
          figure(coralSprite, x, y, scale);
        } else {
          // A new person arrives at the empty spot.
          const e = easeOut(clamp01((t - LOST_GONE - ARRIVE_GAP) / ARRIVE));
          if (e <= 0) continue;
          if (!phone) {
            c.globalAlpha = 0.5 * e * (1 - e) * 4 * (dark ? 0.5 : 0.8);
            halo(posX[i], posY[i] + unit * 0.4, unit * 5);
          }
          c.globalAlpha = da * e;
          figure(baseImg, posX[i], posY[i] + (1 - e) * unit * 0.8, sz * (0.86 + 0.14 * e));
        }
      }
    }

    function draw() {
      const c = ctx!;
      c.clearRect(0, 0, width, height);

      if (pointer.amt > 0.01) {
        c.globalAlpha = (dark ? 0.1 : 0.22) * pointer.amt;
        halo(pointer.x, pointer.y, LANTERN * 1.3);
      }
      drawRings();

      // One stamp per person. Unlit people go first, one alpha per depth band; lit people
      // (wave, lantern) follow with brightness folded into their own stamp, so a lit crowd
      // costs no extra draw calls and the unlit run never changes canvas state.
      const { size, order, depthEnd, depth } = crowd;
      let start = 0;
      let litCount = 0;
      for (let d = 0; d < DEPTHS; d++) {
        c.globalAlpha = depthAlpha[d];
        for (let k = start; k < depthEnd[d]; k++) {
          const i = order[k];
          if (slotOf[i] >= 0) continue;
          if (lit[i] > 0.01) {
            litCount++;
            continue;
          }
          figure(baseImg, posX[i], posY[i], size[i]);
        }
        start = depthEnd[d];
      }
      if (litCount > 0) {
        const n = crowd.n;
        for (let k = 0; k < n; k++) {
          const i = order[k];
          const l = lit[i];
          if (l <= 0.01 || slotOf[i] >= 0) continue;
          const da = depthAlpha[depth[i]];
          c.globalAlpha = da + (1 - da) * l;
          figure(baseImg, posX[i], posY[i], size[i] * (1 + LIT_GROW * l));
        }
      }

      drawLanternLines();
      drawSlots();
      c.globalAlpha = 1;
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
      const should = !reduce && onScreen && !document.hidden && width > 0;
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
      if (!width || !height) return;
      settle();
      draw();
      canvas!.dataset.frames = String(++frames);
    }

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((e.clientX - rect.left) / rect.width) * width;
      const y = ((e.clientY - rect.top) / rect.height) * height;
      pointer.x = x;
      pointer.y = y;
      pointer.inside = x >= 0 && y >= 0 && x <= width && y <= height;
    };
    const onLeave = () => {
      pointer.inside = false;
    };
    const onTap = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !running) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * width;
      const y = ((e.clientY - rect.top) / rect.height) * height;
      if (x < 0 || y < 0 || x > width || y > height) return;
      launchRing(x, y, Math.min(width, height) * 0.32, 1.6, Math.max(18, unit * 6), 0.85);
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
      sync();
    });

    readColors();
    resize();
    ro.observe(host);
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    darkQuery.addEventListener("change", onScheme);
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!reduce) {
      if (fine) {
        window.addEventListener("pointermove", onPointer, { passive: true });
        document.documentElement.addEventListener("pointerleave", onLeave);
      }
      window.addEventListener("pointerdown", onTap, { passive: true });
    }
    sync();

    return () => {
      disposed = true;
      baseBitmap?.close();
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      darkQuery.removeEventListener("change", onScheme);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onTap);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} data-hero-crowd aria-hidden className="absolute inset-0 h-full w-full" />;
}
