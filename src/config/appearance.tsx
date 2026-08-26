"use client";

/**
 * @module config/appearance
 *
 * How a tour looks, and the three different ways you might want to change
 * it. They compose, in this order:
 *
 *   1. **Tokens.** `theme: { accent, cardRadius, fontFamily, … }` writes
 *      CSS custom properties. Reaches everything at once and needs no
 *      knowledge of the markup — the right tool for "match our brand".
 *   2. **Presets.** `theme: { preset: "minimal" }` is a bundle of tokens
 *      with a name, for changing the whole feel in one word. Your own
 *      tokens are applied on top, so a preset is a starting point rather
 *      than a commitment.
 *   3. **Slot classes.** `classNames: { card, title, nextButton, … }`
 *      puts your classes on individual parts. This is the escape hatch
 *      for a design system that owns its own styling — Tailwind, CSS
 *      modules, whatever — without dropping to the render-prop and
 *      rebuilding the card from scratch.
 *
 * Below all three, the render-prop (`<TutorialStage card={…}>`) is still
 * there for total control. The point of this module is that total control
 * should not be the price of changing a colour.
 */

import * as React from "react";
import { createContext, useContext, useMemo } from "react";
import type { TutorialClassNames, TutorialTheme } from "../types";

// ── Presets ─────────────────────────────────────────────────────────────

/**
 * Named looks. Each is only a set of tokens — there is no preset-specific
 * CSS, so a preset can never do something your own tokens cannot.
 */
export const THEME_PRESETS = {
  /** The library's own look: soft gradient, tinted border, glow shadow. */
  default: {},

  /** Flat, high-contrast, hard edges. Gets out of the way. */
  minimal: {
    cardRadius: "0.25rem",
    cardShadow: "0 1px 2px rgba(0,0,0,0.10)",
    cardBackground: "var(--eto-surface)",
    buttonRadius: "0.25rem",
    borderWidth: "1px",
  },

  /** Rounder, airier, heavier shadow. Reads as friendly. */
  soft: {
    cardRadius: "1rem",
    cardShadow: "0 12px 32px -8px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)",
    buttonRadius: "999px",
    cardPadding: "1.125rem",
  },

  /** Translucent and blurred, for tours over imagery or a canvas. */
  glass: {
    cardBackground: "color-mix(in srgb, var(--eto-surface) 72%, transparent)",
    cardBackdropFilter: "blur(12px) saturate(1.4)",
    cardRadius: "0.875rem",
    cardShadow: "0 8px 32px -4px rgba(0,0,0,0.24)",
  },

  /** Thick borders, no shadow, no gradient. */
  contrast: {
    cardRadius: "0",
    cardShadow: "none",
    cardBackground: "var(--eto-surface)",
    borderWidth: "2px",
    buttonRadius: "0",
  },
} satisfies Record<string, TutorialTheme>;

export type ThemePreset = keyof typeof THEME_PRESETS;

// ── Token mapping ───────────────────────────────────────────────────────

/**
 * Theme key → CSS custom property.
 *
 * Every visual decision the built-in components make reads from one of
 * these, which is what makes restyling possible without touching markup.
 */
export const THEME_CSS_VARS: Record<keyof TutorialTheme, string> = {
  // Colour
  accent: "--eto-accent",
  surface: "--eto-surface",
  fg: "--eto-fg",
  muted: "--eto-muted",
  mutedSoft: "--eto-muted-soft",
  border: "--eto-border",
  borderSoft: "--eto-border-soft",
  hoverBg: "--eto-hover-bg",
  arrowColor: "--eto-arrow",
  arrowOpacity: "--eto-arrow-opacity",

  // Typography
  fontFamily: "--eto-font",
  fontSize: "--eto-font-size",
  titleSize: "--eto-title-size",
  titleWeight: "--eto-title-weight",
  lineHeight: "--eto-line-height",

  // Card
  cardWidth: "--eto-card-width",
  cardRadius: "--eto-card-radius",
  cardPadding: "--eto-card-padding",
  cardBackground: "--eto-card-bg",
  cardShadow: "--eto-card-shadow",
  cardBackdropFilter: "--eto-card-backdrop",
  borderWidth: "--eto-border-width",

  // Buttons
  buttonRadius: "--eto-btn-radius",
  buttonPadding: "--eto-btn-padding",
  buttonFontSize: "--eto-btn-font-size",
  primaryButtonBg: "--eto-btn-primary-bg",
  primaryButtonFg: "--eto-btn-primary-fg",

  // Overlays
  spotlightColor: "--eto-spotlight",
  spotlightPadding: "--eto-spotlight-padding",
  spotlightRadius: "--eto-spotlight-radius",
  highlightColor: "--eto-highlight-color",
  seamColor: "--eto-seam",

  // `preset` is not a token — resolved before this map is consulted.
  preset: "",
};

/**
 * Flatten a theme (preset first, explicit tokens on top) into CSS custom
 * properties.
 */
export function themeToCssVars(theme: TutorialTheme | undefined): Record<string, string> {
  if (!theme) return {};
  const base = theme.preset ? THEME_PRESETS[theme.preset] ?? {} : {};
  const merged = { ...base, ...theme } as Record<string, unknown>;

  const vars: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(THEME_CSS_VARS)) {
    if (!cssVar) continue;
    const value = merged[key];
    if (value !== undefined && value !== null) vars[cssVar] = String(value);
  }
  return vars;
}

// ── Slot classes ────────────────────────────────────────────────────────

const AppearanceContext = createContext<TutorialClassNames>({});

export function AppearanceProvider(props: {
  classNames: TutorialClassNames | undefined;
  children: React.ReactNode;
}) {
  const { classNames, children } = props;
  // Identity-stable per set of values, so a card does not re-render
  // because the host wrote its classNames object inline.
  const key = JSON.stringify(classNames ?? {});
  const value = useMemo(() => classNames ?? {}, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
  );
}

/**
 * The host's class for one slot, appended to the library's own.
 *
 * The built-in class always comes first so `.eto-*` rules stay
 * overridable by later, more specific host CSS.
 */
export function useSlotClass(slot: keyof TutorialClassNames, base: string): string {
  const classNames = useContext(AppearanceContext);
  const extra = classNames[slot];
  return extra ? `${base} ${extra}` : base;
}

export function useClassNames(): TutorialClassNames {
  return useContext(AppearanceContext);
}
