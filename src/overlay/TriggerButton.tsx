"use client";

/**
 * @module overlay/TriggerButton
 *
 * Alpha.20: configurable tutorial trigger button.
 *
 * Modes:
 *   - "attention" — animated gradient pulse, impossible to miss
 *   - "subtle"    — calm accent-tinted button
 *   - "minimal"   — icon-only circle
 *
 * Hides automatically when the tutorial is active (stepId !== null).
 * The host places it anywhere in their layout and provides `onClick`.
 *
 * ```tsx
 * <TriggerButton
 *   text="Take the tour"
 *   mode="attention"
 *   onClick={() => setStepId(steps[0].id)}
 * />
 * ```
 */

import * as React from "react";
import { useTutorial } from "../core/Tutorial";

// ── Types ───────────────────────────────────────────────────────────────

export type TriggerMode = "attention" | "subtle" | "minimal";

export interface TriggerButtonProps {
  /** Click handler — typically calls setStepId(firstStep.id). */
  onClick: () => void;
  /** Button text. Default "Start tutorial". Ignored in "minimal" mode. */
  text?: string;
  /** Visual mode. Default "subtle". */
  mode?: TriggerMode;
  /** Show the help-circle icon. Default true. */
  icon?: boolean;
  /** Override the automatic hide-when-active behaviour. */
  visible?: boolean;
  /** Additional CSS class on the wrapper. */
  className?: string;
  /** Additional inline styles on the wrapper. */
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
    mode = "subtle",
    icon = true,
    visible: visibleProp,
    className,
    style,
  } = props;

  const { step } = useTutorial();
  const isActive = step !== null;

  // Auto-hide when tutorial is running (unless overridden)
  const visible = visibleProp ?? !isActive;
  if (!visible) return null;

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