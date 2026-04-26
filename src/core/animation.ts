"use client";

/**
 * @module core/animation
 *
 * Central animation engine for next-easytour.
 *
 *   - `useFrameSequence` — state-machine-driven frame cycling
 *   - `useEnterAnimation` — CSS enter class on mount / key change
 *   - `useArrowDraw` — SVG stroke-dashoffset draw-on
 *
 * Design principles:
 *   - Single timer per state (no nested setTimeout)
 *   - All timers tracked and cleaned up on unmount/re-render
 *   - CSS drives visuals; hooks drive timing and class names
 *   - Trigger counter pattern for re-triggering on same step
 */

import { useEffect, useRef, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────

export interface FrameSequenceOptions {
  /** Duration per frame in ms. Default 2000. */
  frameDuration?: number;
  /** CSS transition duration in ms. Default 300. */
  transitionDuration?: number;
  /** Loop after the last frame. Default false. */
  loop?: boolean;
  /** Delay before the first frame enters, in ms. Default 0. */
  delay?: number;
  /** Whether the sequence is enabled. Default true. */
  enabled?: boolean;
  /** Called when the frame index changes. */
  onFrameChange?: (index: number) => void;
}

export type AnimPhase = "delay" | "entering" | "visible" | "exiting";

export interface FrameSequenceState<T> {
  current: T;
  index: number;
  phase: AnimPhase;
  done: boolean;
}

// ── useFrameSequence ────────────────────────────────────────────────────

/**
 * State machine:
 *
 *   (delay) → "entering" → "visible" → "exiting" → advance index →
 *   "entering" → "visible" → "exiting" → ...
 *
 * Each phase sets ONE timer that transitions to the next phase.
 * Content (the returned `current`) updates when the index advances,
 * which happens at the exiting→entering boundary.
 */
export function useFrameSequence<T>(
  frames: T[],
  options: FrameSequenceOptions = {},
): FrameSequenceState<T> {
  const {
    frameDuration = 2000,
    transitionDuration = 300,
    loop = false,
    delay = 0,
    enabled = true,
    onFrameChange,
  } = options;

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<AnimPhase>(delay > 0 ? "delay" : "entering");
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  // Reset when frames identity changes
  const framesLenRef = useRef(frames.length);
  useEffect(() => {
    if (frames.length !== framesLenRef.current) {
      framesLenRef.current = frames.length;
      setIndex(0);
      setPhase(delay > 0 ? "delay" : "entering");
      setDone(false);
    }
  }, [frames.length, delay]);

  // ── State machine: one effect per phase ───────────────────────────
  useEffect(() => {
    if (!enabled || done) return;
    clearTimeout(timerRef.current);

    switch (phase) {
      case "delay":
        timerRef.current = setTimeout(() => setPhase("entering"), delay);
        break;

      case "entering":
        timerRef.current = setTimeout(() => setPhase("visible"), transitionDuration);
        break;

      case "visible":
        // Single-frame or disabled: stay visible forever
        if (frames.length <= 1) break;
        timerRef.current = setTimeout(() => setPhase("exiting"), frameDuration);
        break;

      case "exiting":
        timerRef.current = setTimeout(() => {
          // Advance the frame
          setIndex((prev) => {
            const next = prev + 1;
            if (next >= frames.length) {
              if (loop) {
                onFrameChangeRef.current?.(0);
                return 0;
              }
              setDone(true);
              return prev; // stay on last
            }
            onFrameChangeRef.current?.(next);
            return next;
          });
          setPhase("entering");
        }, transitionDuration);
        break;
    }

    return () => clearTimeout(timerRef.current);
  }, [phase, enabled, done, frames.length, frameDuration, transitionDuration, loop, delay]);

  const safeIndex = Math.min(index, Math.max(frames.length - 1, 0));

  return {
    current: frames[safeIndex],
    index: safeIndex,
    phase,
    done,
  };
}

// ── useEnterAnimation ───────────────────────────────────────────────────

/**
 * Returns the enter CSS class name while the animation is playing.
 * Re-triggers on every `key` change (including initial mount).
 * Uses a trigger counter so navigating away and back to the same
 * step still replays the animation.
 */
export function useEnterAnimation(
  key: string | null,
  enterClass: string,
  duration: number = 250,
): string {
  const [trigger, setTrigger] = useState(0);
  const [active, setActive] = useState(true);
  const prevKey = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Trigger on key change (including first render)
  useEffect(() => {
    if (key !== prevKey.current) {
      prevKey.current = key;
      setTrigger((t) => t + 1);
    }
  }, [key]);

  // Run animation on trigger
  useEffect(() => {
    setActive(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActive(false), duration);
    return () => clearTimeout(timerRef.current);
  }, [trigger, duration]);

  return active ? enterClass : "";
}

// ── useArrowDraw ────────────────────────────────────────────────────────

/**
 * SVG stroke-dashoffset draw-on animation. Uses a trigger counter
 * so the animation replays when:
 *   - stepId changes
 *   - pathLength goes from 0 to positive (SVG rendered)
 *
 * The draw works by:
 *   1. Set dashoffset = pathLength (path hidden)
 *   2. Next frame: set dashoffset = 0 with CSS transition
 *   3. The browser interpolates → draw-on effect
 */
export function useArrowDraw(
  pathLength: number,
  stepId: string | null,
  enabled: boolean = true,
  duration: number = 400,
): { dashArray?: number; dashOffset: number; transitioning: boolean } {
  const [trigger, setTrigger] = useState(0);
  const [offset, setOffset] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const prevStepId = useRef(stepId);
  const prevPathLength = useRef(pathLength);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const rafRef = useRef<number>(0);

  // Trigger on step change
  useEffect(() => {
    if (stepId !== prevStepId.current) {
      prevStepId.current = stepId;
      setTrigger((t) => t + 1);
    }
  }, [stepId]);

  // Trigger when pathLength goes from 0 to positive (first render)
  useEffect(() => {
    if (prevPathLength.current === 0 && pathLength > 0) {
      setTrigger((t) => t + 1);
    }
    prevPathLength.current = pathLength;
  }, [pathLength]);

  // Run draw animation on trigger
  useEffect(() => {
    if (!enabled || pathLength <= 0) return;

    // Step 1: set to full offset (hidden)
    setOffset(pathLength);
    setTransitioning(false);

    // Step 2: next frame, animate to 0
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setTransitioning(true);
        setOffset(0);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setTransitioning(false), duration);
      });
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, [trigger, enabled, pathLength, duration]);

  if (!enabled || pathLength <= 0) {
    return { dashOffset: 0, transitioning: false };
  }

  return {
    dashArray: pathLength,
    dashOffset: offset,
    transitioning,
  };
}