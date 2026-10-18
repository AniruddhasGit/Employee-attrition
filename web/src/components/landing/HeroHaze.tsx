"use client";

import { useEffect, useRef } from "react";

const PEOPLE = 1470;
const LEFT = 237; // employees in the dataset who left

type Particle = {
  ox: number; // home position, 0..1 of the canvas
  oy: number;
  r: number;
  phase: number;
  speed: number;
  leaver: boolean;
  drift: number; // how far along its exit path a leaver is, 0..1
};

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeParticles(): Particle[] {
  const rand = seeded(1470);
  const out: Particle[] = [];
  for (let i = 0; i < PEOPLE; i++) {
    // A soft spray along an arc, like breath in cold air: denser at the core, thinning outward.
    const t = rand();
    const angle = -0.35 + t * 2.4;
    const radius = 0.18 + Math.pow(rand(), 0.6) * 0.32;
    const spread = (rand() - 0.5) * 0.09 * (1 + t);
    out.push({
      ox: 0.4 + Math.cos(angle) * radius * 0.95 + spread,
      oy: 0.5 - Math.sin(angle) * radius * 0.75 + spread * 0.6,
      r: 0.5 + rand() * 1.3,
      phase: rand() * Math.PI * 2,
      speed: 0.15 + rand() * 0.35,
      leaver: i % Math.round(PEOPLE / LEFT) === 0,
      drift: rand(),
    });
  }
  return out;
}

/**
 * The hero's atmosphere: 1,470 particles, one per employee in the dataset.
 * The ~16% who left drift slowly out of the cloud to the right, then reform.
 * Pauses when off-screen or the tab is hidden. Reduced motion: one still frame.
 */
export function HeroHaze() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles = makeParticles();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let width = 0;
    let height = 0;
    let raf = 0;
    let visible = true;
    let last = performance.now();

    const css = getComputedStyle(document.documentElement);
    const signal = css.getPropertyValue("--signal").trim() || "#c84f25";
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dotColor = dark ? "232,236,239" : "255,255,255";

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(time: number) {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      ctx!.clearRect(0, 0, width, height);
      const scale = Math.min(width, height * 1.6);
      const offsetX = (width - scale) / 2;
      const offsetY = (height - scale / 1.6) / 2;

      for (const p of particles) {
        const wobble = reduce ? 0 : Math.sin(time * 0.0004 * p.speed * 6 + p.phase) * 0.006;
        let x = p.ox + wobble + pointer.x * 0.012 * p.r;
        let y = p.oy + Math.cos(time * 0.0003 * p.speed * 6 + p.phase) * (reduce ? 0 : 0.005) + pointer.y * 0.01 * p.r;
        let alpha = 0.28 + p.r * 0.22;

        if (p.leaver) {
          if (!reduce) p.drift = (p.drift + dt * 0.035 * p.speed) % 1;
          const e = p.drift * p.drift;
          x += e * 0.55;
          y -= e * 0.12;
          alpha *= 1 - e;
        }

        const px = offsetX + x * scale;
        const py = offsetY + y * (scale / 1.6);
        if (px < -4 || px > width + 4) continue;
        ctx!.beginPath();
        ctx!.arc(px, py, p.leaver ? p.r + 0.4 : p.r, 0, Math.PI * 2);
        ctx!.fillStyle = p.leaver ? signal : `rgba(${dotColor},${alpha})`;
        if (p.leaver) ctx!.globalAlpha = alpha * 0.9;
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(draw);
    }

    function start() {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(draw);
    }

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - rect.left) / rect.width - 0.5;
      pointer.ty = (e.clientY - rect.top) / rect.height - 0.5;
    };
    const onVisibility = () => {
      if (!document.hidden && visible && !reduce) start();
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !reduce) start();
    });
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(performance.now());
    });

    resize();
    ro.observe(canvas);
    io.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      window.addEventListener("pointermove", onPointer, { passive: true });
    }
    if (reduce) draw(performance.now());
    else start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
