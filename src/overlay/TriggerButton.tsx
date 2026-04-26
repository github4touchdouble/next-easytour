"use client";

/**
 * @module overlay/TriggerButton
 *
 * Tutorial trigger button with completion-aware mode switching.
 *
 * Pass `done` (from `useTutorialDone`) and the button auto-switches:
 *   - `done=false` → "attention" mode (red pulse, strobe, rattle)
 *   - `done=true`  → "subtle" mode (calm accent pill)
 *
 * Or set `mode` explicitly to override.
 *
 * Hides automatically when the tutorial is active.
 */

import * as React from "react";

// ── Types ───────────────────────────────────────────────────────────────

export type TriggerMode = "attention" | "subtle" | "minimal";

export interface TriggerButtonProps {
  /** Click handler — typically calls setStepId(firstStep.id). */
  onClick: () => void;
  /** Button text. Default "Start tutorial". Ignored in "minimal" mode. */
  text?: string;
  /**
   * Visual mode. When omitted, auto-selects based on `done`:
   *   - `done=false` → "attention"
   *   - `done=true`  → "subtle"
   */
  mode?: TriggerMode;
  /** Whether the tutorial has been completed. Drives auto mode selection. */
  done?: boolean;
  /** Show the help-circle icon. Default true. */
  icon?: boolean;
  /** Control visibility. Default true. The host gates rendering. */
  visible?: boolean;
  /** Additional CSS class on the button. */
  className?: string;
  /** Additional inline styles on the button. */
  style?: React.CSSProperties;
}

// ── Icon ────────────────────────────────────────────────────────────────

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

// ── Component ───────────────────────────────────────────────────────────

export function TriggerButton(props: TriggerButtonProps) {
  const {
    onClick,
    text = "Start tutorial",
    mode: modeProp,
    done = false,
    icon = true,
    visible = true,
    className,
    style,
  } = props;

  if (!visible) return null;

  // Auto mode: attention when not done, subtle when done
  const mode = modeProp ?? (done ? "subtle" : "attention");

  const cls = [
    "eto-trigger",
    `eto-trigger--${mode}`,
    className,
  ].filter(Boolean).join(" ");

  return (
    <button type="button" className={cls} style={style} onClick={onClick}>
      {icon && <HelpIcon size={mode === "minimal" ? 16 : 14} />}
      {mode !== "minimal" && <span className="eto-trigger-text">{text}</span>}
    </button>
  );
}