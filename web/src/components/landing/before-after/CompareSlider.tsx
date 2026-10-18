"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValueEvent,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { EASE_IN_OUT, EASE_OUT } from "@/lib/motion";

/** Seconds for a full 0 -> 1 leg of the autoplay. Shorter legs scale down with distance. */
const LEG = 7;
/** Seconds the story rests at each end so both states can be read. */
const HOLD = 1.2;
/** Seconds of no interaction before autoplay picks up again. */
const IDLE = 3;
const STEP = 0.05;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function valueText(v: number) {
  if (v <= 0.02) return "Original notebook";
  if (v >= 0.98) return "Honest model";
  return "Between the two";
}

function useTabVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return visible;
}

/**
 * Drives t: a slow eased ping-pong while the section is on screen and the tab is visible,
 * paused by any interaction and resumed from wherever the reader left it after IDLE seconds.
 */
export function useCompareDriver(t: MotionValue<number>, sectionRef: RefObject<Element | null>, reduce: boolean) {
  const inView = useInView(sectionRef, { amount: 0.3 });
  const tabVisible = useTabVisible();
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const idleTimer = useRef<number | undefined>(undefined);
  const gen = useRef(0); // bumps on every stop so stale callbacks do nothing
  const heading = useRef<0 | 1>(1); // where the autoplay is going
  const jumpTarget = useRef<number | null>(null);
  const interacting = useRef(false);
  const pressed = useRef(false); // pointer held on the track
  const allowed = useRef(false);
  const running = useRef(false);

  const halt = useCallback(() => {
    gen.current += 1;
    anim.current?.stop();
    anim.current = null;
    window.clearTimeout(holdTimer.current);
    running.current = false;
  }, []);

  const leg = useCallback(
    (target: 0 | 1) => {
      const g = gen.current;
      heading.current = target;
      const distance = Math.abs(target - t.get());
      const next = () => {
        if (g !== gen.current) return;
        holdTimer.current = window.setTimeout(() => g === gen.current && leg(target === 1 ? 0 : 1), HOLD * 1000);
      };
      if (distance < 0.001) {
        next();
        return;
      }
      anim.current = animate(t, target, {
        duration: Math.max(1.2, LEG * distance),
        ease: EASE_IN_OUT,
        onComplete: next,
      });
    },
    [t],
  );

  const play = useCallback(
    (target: 0 | 1) => {
      halt();
      running.current = true;
      const g = gen.current;
      // Resting at the other end: let it be read before setting off.
      if (Math.abs(target - t.get()) > 0.999) {
        holdTimer.current = window.setTimeout(() => g === gen.current && leg(target), HOLD * 1000);
      } else {
        leg(target);
      }
    },
    [halt, leg, t],
  );

  const sync = useCallback(() => {
    const should = allowed.current && !interacting.current;
    if (should && !running.current) play(heading.current);
    if (!should && running.current) halt();
  }, [halt, play]);

  useEffect(() => {
    allowed.current = inView && tabVisible && !reduce;
    sync();
  }, [inView, tabVisible, reduce, sync]);

  useEffect(() => {
    if (reduce) {
      halt();
      t.set(1);
    }
  }, [reduce, halt, t]);

  useEffect(
    () => () => {
      halt();
      window.clearTimeout(idleTimer.current);
    },
    [halt],
  );

  /** Starts (or restarts) the quiet period after which autoplay resumes. */
  const restartIdle = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(function resume() {
      if (pressed.current) {
        idleTimer.current = window.setTimeout(resume, IDLE * 1000);
        return;
      }
      interacting.current = false;
      jumpTarget.current = null;
      heading.current = t.get() < 0.5 ? 1 : 0; // toward the far end, from right here
      sync();
    }, IDLE * 1000);
  }, [sync, t]);

  /** Any interaction: stop autoplay (and any glide) now. */
  const touch = useCallback(() => {
    interacting.current = true;
    halt();
    restartIdle();
  }, [halt, restartIdle]);

  /** Glide (or, with reduced motion, step) to a value. */
  const jump = useCallback(
    (to: number, duration: number) => {
      touch();
      const v = clamp01(to);
      jumpTarget.current = v;
      if (reduce) {
        t.set(v);
        return;
      }
      anim.current = animate(t, v, { duration, ease: EASE_OUT });
    },
    [reduce, t, touch],
  );

  /** Follow a finger or pointer exactly. */
  const setNow = useCallback(
    (to: number) => {
      touch();
      jumpTarget.current = null;
      t.set(clamp01(to));
    },
    [t, touch],
  );

  const base = useCallback(() => jumpTarget.current ?? t.get(), [t]);

  const press = useCallback(
    (on: boolean) => {
      pressed.current = on;
      if (!on) restartIdle(); // the quiet period starts when the pointer lets go
    },
    [restartIdle],
  );

  return { jump, setNow, base, press };
}

type Driver = ReturnType<typeof useCompareDriver>;

/** The track is a real slider: drag the dot, click the track, or use the keyboard. */
export function CompareSlider({ t, driver }: { t: MotionValue<number>; driver: Driver }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const transform = useTransform(t, (v) => `translateX(${v * 100}%)`);
  const beforeOpacity = useTransform(t, [0, 0.5], [1, 0.55]);
  const afterOpacity = useTransform(t, [0.5, 1], [0.55, 1]);

  // ARIA state is written straight to the node: no React render per frame.
  const writeAria = useCallback((v: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.setAttribute("aria-valuenow", String(Math.round(v * 100)));
    el.setAttribute("aria-valuetext", valueText(v));
  }, []);
  useMotionValueEvent(t, "change", writeAria);
  // Rendered once and never changed, so React leaves the live values written above alone.
  const [initial] = useState(() => t.get());
  useEffect(() => writeAria(t.get()), [t, writeAria]);

  const valueAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return t.get();
    return (clientX - rect.left) / rect.width;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    driver.press(true);
    driver.jump(valueAt(e.clientX), 0.35);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    driver.setNow(valueAt(e.clientX));
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    driver.press(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, (v: number) => number> = {
      ArrowRight: (v) => v + STEP,
      ArrowUp: (v) => v + STEP,
      ArrowLeft: (v) => v - STEP,
      ArrowDown: (v) => v - STEP,
      PageUp: (v) => v + STEP * 4,
      PageDown: (v) => v - STEP * 4,
      Home: () => 0,
      End: () => 1,
    };
    const step = keys[e.key];
    if (!step) return;
    e.preventDefault();
    const to = e.key === "Home" || e.key === "End" ? step(0) : Math.round(step(driver.base()) * 100) / 100;
    driver.jump(to, e.key === "Home" || e.key === "End" ? 0.6 : 0.25);
  };

  return (
    <div className="mt-8 max-w-sm">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Compare the original notebook with the honest model"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(initial * 100)}
        aria-valuetext={valueText(initial)}
        aria-orientation="horizontal"
        data-dragging={dragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className={`group relative -mx-2 select-none px-2 py-4 [touch-action:pan-y] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div className="relative h-px bg-line">
          <motion.div style={{ transform }} className="pointer-events-none absolute inset-x-0 -top-[5px]">
            <span className="absolute -left-[5px] block size-[11px] rounded-full bg-signal transition-transform duration-200 ease-[var(--ease-out)] group-hover:scale-[1.35] group-data-[dragging]:scale-[1.6]" />
          </motion.div>
        </div>
      </div>
      <div className="mt-1 flex justify-between text-xs">
        <motion.button
          type="button"
          style={{ opacity: beforeOpacity }}
          onClick={() => driver.jump(0, 0.8)}
          className="-mx-1 cursor-pointer px-1 py-1 hover:underline hover:underline-offset-4"
        >
          Original notebook
        </motion.button>
        <motion.button
          type="button"
          style={{ opacity: afterOpacity }}
          onClick={() => driver.jump(1, 0.8)}
          className="-mx-1 cursor-pointer px-1 py-1 hover:underline hover:underline-offset-4"
        >
          Honest model
        </motion.button>
      </div>
    </div>
  );
}
