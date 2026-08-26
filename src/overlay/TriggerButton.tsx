"use client";

/**
 * @module overlay/TriggerButton
 *
 * Two modes:
 *   - "annoying" — flashy red pulse UNTIL the user completes the tutorial
 *     (done=true), then renders as "default" automatically.
 *   - "default"  — calm accent-tinted pill, always.
 *
 * The host controls `done` via `useTutorialDone()`.
 * The editor configures which mode is active.
 * The component works outside <Tutorial> — no context dependency.
 */

import * as React from "react";

export type TriggerMode = "annoying" | "default";

export interface TriggerButtonProps {
  onClick: () => void;
  text?: string;
  /** Which mode the admin configured. Default "default". */
  mode?: TriggerMode;
  /** Has the user completed the tutorial? When true, "annoying" renders as "default". */
  done?: boolean;
  icon?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function HelpIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * Forwards its ref to the underlying `<button>` so the editor seam can
 * measure the tour's entry point without wrapping it in extra DOM.
 */
export const TriggerButton = React.forwardRef<HTMLButtonElement, TriggerButtonProps>(
  function TriggerButton(props, ref) {
    const {
      onClick,
      text = "Start tutorial",
      mode = "default",
      done = false,
      icon = true,
      className,
      style,
    } = props;

    // "annoying" downgrades to "default" once the user has completed the tutorial
    const visualMode = (mode === "annoying" && !done) ? "annoying" : "default";

    const cls = [
      "eto-trigger",
      `eto-trigger--${visualMode}`,
      className,
    ].filter(Boolean).join(" ");

    return (
      <button ref={ref} type="button" className={cls} style={style} onClick={onClick}>
        {icon && <HelpIcon />}
        <span className="eto-trigger-text">{text}</span>
      </button>
    );
  },
);