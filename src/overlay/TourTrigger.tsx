"use client";

/**
 * @module overlay/TourTrigger
 *
 * The start button, wired to the tour.
 *
 * `<TriggerButton>` is the presentational component and still takes
 * every prop by hand. `<TourTrigger>` is the one you want inside a
 * `<TutorialProvider>`: it reads the trigger config — including a config
 * saved from the editor — plus completion state and the open handler,
 * and hides itself when the tour cannot run.
 *
 * That last part matters: under 0.3 the editor could save `triggerConfig`
 * but the button was rendered with hand-passed props, so a saved change
 * to the button's text or mode never appeared anywhere.
 */

import * as React from "react";
import { useCallback, useEffect, useRef } from "react";
import { useTourInternal } from "../core/TutorialProvider";
import { useSlotClass } from "../config/appearance";
import { TriggerButton, type TriggerButtonProps } from "./TriggerButton";

export interface TourTriggerProps
  extends Omit<TriggerButtonProps, "onClick" | "done"> {
  /** Render even while the tour is open. Default `false`. */
  showWhileOpen?: boolean;
  /** Step to open. Defaults to the first step. */
  startAt?: string;
  /** Run alongside opening the tour — analytics, closing a menu. */
  onStart?: () => void;
}

export function TourTrigger(props: TourTriggerProps) {
  const { showWhileOpen = false, startAt, onStart, ...buttonProps } = props;

  const tour = useTourInternal();
  if (!tour) {
    throw new Error(
      "[next-easytour] <TourTrigger> rendered outside <TutorialProvider>. " +
        "Use <TriggerButton> directly if you are wiring the tour by hand.",
    );
  }

  const triggerClass = useSlotClass("trigger", "");
  const registerTrigger = tour.registerTrigger;
  const elRef = useRef<HTMLElement | null>(null);

  // A callback ref, so the provider learns about the button the moment it
  // mounts, moves, or unmounts — including the unmount when the tour
  // opens and this component returns null, which retracts the seam.
  const setRef = useCallback(
    (el: HTMLButtonElement | null) => {
      elRef.current = el;
      registerTrigger(el);
    },
    [registerTrigger],
  );

  useEffect(() => () => registerTrigger(null), [registerTrigger]);

  if (!tour.available) return null;
  if (tour.isOpen && !showWhileOpen) return null;

  // Explicit props beat the saved/config trigger, so a caller can still
  // override one field at one call site without editing the config.
  return (
    <TriggerButton
      ref={setRef}
      text={buttonProps.text ?? tour.trigger.text}
      mode={buttonProps.mode ?? tour.trigger.mode}
      icon={buttonProps.icon ?? tour.trigger.icon}
      className={[triggerClass, buttonProps.className].filter(Boolean).join(" ") || undefined}
      style={buttonProps.style}
      done={tour.done}
      onClick={() => {
        onStart?.();
        tour.start(startAt);
      }}
    />
  );
}
