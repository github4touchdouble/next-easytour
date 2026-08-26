/**
 * @module config/defineTutorial
 *
 * One config object for a whole tour.
 *
 * Under 0.3 a tour's settings were spread across four components —
 * `<Tutorial>` held navigation and theming, `<Editor>` held saving and
 * permissions, `<TriggerButton>` held its own text and mode (which the
 * editor could save but the button never read back), and
 * `useTutorialDone` held a cookie name. Nothing pointed at anything
 * else, so the same tour had to be described in four places.
 *
 * `defineTutorial` collects all of it, applies defaults, and validates
 * in development. It is otherwise inert — call it at module scope and
 * hand the result to `<TutorialProvider>`.
 */

import type { EditorPermission } from "./permission";
import type { TutorialStore } from "../data/stores";
import { staticStore } from "../data/stores";
import type {
  Step,
  TransitionConfig,
  TriggerConfig,
  TutorialClassNames,
  TutorialTheme,
  ViewportAnchor,
} from "../types";

// ── Config ──────────────────────────────────────────────────────────────

export interface CardConfig {
  /**
   * `"fixed"` pins the card to the viewport; `"absolute"` lets it scroll
   * with the page. Default `"fixed"`.
   */
  positioning?: "fixed" | "absolute";
  /** Default position for steps without their own `cardAnchor`. */
  anchor?: ViewportAnchor;
}

export interface CompletionConfig {
  /**
   * Cookie name recording completion. Defaults to `"<id>-done"`, so a
   * tour gets sensible persistence without naming a cookie by hand.
   */
  key?: string;
  /**
   * When to record completion:
   *   - `"last-step"` (default) — as soon as the last step is reached.
   *   - `"finish"` — only when the tour is finished or closed from the
   *     last step, so a user who bails early still gets prompted again.
   *   - `"never"` — the host calls `markDone()` itself.
   */
  markOn?: "last-step" | "finish" | "never";
}

export interface EditorConfig {
  /** Who may edit, and how they turn editing on. Default: nobody. */
  permission?: EditorPermission;
  /** Show the sidebar step editor when editing. Default `true`. */
  panel?: boolean;
  /** Show drag handles for card/arrow when editing. Default `true`. */
  handles?: boolean;
  /** Re-read the store after a successful save. Default `true`. */
  reloadAfterSave?: boolean;
}

export interface FeaturesConfig {
  /**
   * Put the app back the way the tour found it when it closes, using each
   * feature's `snapshot` / `restore`. Default `true`.
   *
   * A tour that ends leaving a filter applied and a mode switched has
   * made the user's app worse for having been helpful.
   */
  restoreOnClose?: boolean;
}

export interface AutoStartConfig {
  /** Only auto-start for users who have not completed the tour. Default `true`. */
  once?: boolean;
  /** Delay before opening, in ms. Default 0. */
  delay?: number;
}

export interface TutorialConfig<Meta = never> {
  /** Stable identifier. Namespaces the completion cookie and warnings. */
  id: string;
  /** Steps defined in code. Ignored when `store` is set. */
  steps?: Step<Meta>[];
  /** Where steps are read from and written back to. */
  store?: TutorialStore<Meta>;

  /** Tokens and/or a preset. See `TutorialTheme`. */
  theme?: TutorialTheme;
  /**
   * Classes for individual parts of the built-in card and trigger, for a
   * design system that owns its own styling.
   */
  classNames?: TutorialClassNames;
  card?: CardConfig;
  transition?: TransitionConfig;
  scrollIntoView?: boolean | ScrollIntoViewOptions;

  /** Defaults for `<TourTrigger>`. A saved trigger config overrides these. */
  trigger?: TriggerConfig;
  completion?: CompletionConfig | false;
  editor?: EditorConfig;
  /** How the tour interacts with host features. */
  features?: FeaturesConfig;

  /**
   * Minimum viewport width, in px, for the tour to run. Evaluated with
   * `matchMedia` in an effect, so it never desyncs SSR markup the way a
   * bare `window.innerWidth` check in render does.
   */
  minWidth?: number;
  /** Media query gating the tour. Takes precedence over `minWidth`. */
  media?: string;
  /** Hard off switch — a feature flag, say. Default `true`. */
  enabled?: boolean;

  /** Open the tour automatically on mount. Default off. */
  autoStart?: boolean | AutoStartConfig;

  /**
   * How users reach this tour. Default `"trigger"`.
   *
   * A tour is a feature no one can use if nothing opens it, and that
   * mistake is invisible — the page simply looks normal. With
   * `"trigger"`, the library warns in development when neither a
   * `<TourTrigger>` nor `autoStart` is present. Set `"custom"` when you
   * open the tour yourself via `useTour().start()`.
   */
  entryPoint?: "trigger" | "custom";
}

/** A config with defaults filled in. Produced by `defineTutorial`. */
export interface ResolvedTutorialConfig<Meta = never> extends TutorialConfig<Meta> {
  store: TutorialStore<Meta>;
  card: Required<Pick<CardConfig, "positioning">> & CardConfig;
  completion: Required<CompletionConfig> | false;
  editor: Required<Omit<EditorConfig, "permission">> & { permission?: EditorPermission };
  features: Required<FeaturesConfig>;
  enabled: boolean;
  autoStart: false | Required<AutoStartConfig>;
}

// ── Validation ──────────────────────────────────────────────────────────

/** Config problems worth telling the author about, in development. */
export function validateConfig<Meta>(config: TutorialConfig<Meta>): string[] {
  const problems: string[] = [];
  if (!config.id || config.id.trim() === "") {
    problems.push("`id` is required — it namespaces the completion cookie.");
  }
  if (config.steps && config.store) {
    problems.push("`steps` and `store` are both set; `store` wins and `steps` is ignored.");
  }
  if (!config.steps && !config.store) {
    problems.push("neither `steps` nor `store` is set — the tour has nothing to show.");
  }
  if (config.media && config.minWidth !== undefined) {
    problems.push("`media` and `minWidth` are both set; `media` wins.");
  }
  if (config.editor?.permission !== undefined && config.editor.permission !== false && !config.store) {
    problems.push("editing is permitted but no `store` is set — Save will fall back to the clipboard.");
  }
  if (config.entryPoint === "custom" && config.autoStart) {
    problems.push('`entryPoint: "custom"` with `autoStart` set is redundant — autoStart is already an entry point.');
  }
  return problems;
}

// ── Entry point ─────────────────────────────────────────────────────────

/**
 * Validate a tutorial config and fill in defaults.
 *
 * ```ts
 * export const tour = defineTutorial({
 *   id: "onboarding",
 *   store: httpStore("/tour.json", { saveTo: "/api/tour" }),
 *   trigger: { text: "Take the tour", mode: "annoying" },
 *   editor: { permission: { allow: "dev-only" } },
 * });
 * ```
 */
export function defineTutorial<Meta = never>(
  config: TutorialConfig<Meta>,
): ResolvedTutorialConfig<Meta> {
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    for (const problem of validateConfig(config)) {
      // eslint-disable-next-line no-console
      console.warn(`[next-easytour] tutorial "${config.id}": ${problem}`);
    }
  }

  const completion: Required<CompletionConfig> | false =
    config.completion === false
      ? false
      : {
          key: config.completion?.key ?? `${config.id}-done`,
          markOn: config.completion?.markOn ?? "last-step",
        };

  const autoStart: false | Required<AutoStartConfig> =
    config.autoStart === undefined || config.autoStart === false
      ? false
      : {
          once: config.autoStart === true ? true : (config.autoStart.once ?? true),
          delay: config.autoStart === true ? 0 : (config.autoStart.delay ?? 0),
        };

  return {
    ...config,
    store: config.store ?? staticStore<Meta>(config.steps ?? []),
    card: { positioning: "fixed", ...config.card },
    completion,
    editor: {
      panel: config.editor?.panel ?? true,
      handles: config.editor?.handles ?? true,
      reloadAfterSave: config.editor?.reloadAfterSave ?? true,
      ...(config.editor?.permission !== undefined
        ? { permission: config.editor.permission }
        : {}),
    },
    features: { restoreOnClose: config.features?.restoreOnClose ?? true },
    enabled: config.enabled ?? true,
    autoStart,
  };
}
