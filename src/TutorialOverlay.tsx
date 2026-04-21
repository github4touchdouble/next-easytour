"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft, X, Copy, Check } from "lucide-react";
import type {
  ArrowPoint,
  ArrowStyle,
  TutorialCircle,
  TutorialStep,
  TutorialOverlayProps,
  ImageLike,
} from "./types";
import {
  DEFAULT_STYLE,
  autoTargetPoint,
  resolvePoint,
  cardSourcePx,
  pixelToRelative,
  buildPath,
} from "./geometry";

/** Fallback image component — plain HTML `<img>`. Users can inject `next/image`
 *  (or any other framework-specific image component) via the `ImageComponent`
 *  prop to opt into framework integrations without forcing a `next` peer dep. */
const DefaultImage: ImageLike = ({ src, alt, width, height, style }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} width={width} height={height} style={style} />
);

/**
 * Interactive step-based tutorial overlay.
 *
 * Renders a compact card anchored to the bottom of its parent (or wherever
 * it's mounted) with an animated Bézier arrow pointing at the current
 * step's target element. Target elements are identified by the
 * `data-tutorial-id` HTML attribute — add one to any element you want to
 * highlight:
 *
 *     <button data-tutorial-id="save-button">Save</button>
 *
 * and reference it from a step:
 *
 *     { target: "save-button", title: "Save your work", body: "..." }
 *
 * In `debug` mode the overlay becomes a visual authoring editor: drag the
 * arrow tip, tweak bend/stroke/head via sliders, reposition and resize
 * annotation circles, and hit Save to persist the updated step list via
 * the supplied `onSave` callback. If `onSave` is omitted the library
 * falls back to copying the JSON to the clipboard.
 */
export function TutorialOverlay({
  steps,
  step,
  onStepChange,
  onClose,
  isDark = false,
  logoSrc,
  logoWidth = 44,
  logoHeight = 14,
  headerLabel = "Guide",
  ImageComponent = DefaultImage,
  onAction,
  debug = false,
  onSave,
  onSaved,
}: TutorialOverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const uidRef = useRef(`tut-${Math.random().toString(36).slice(2, 8)}`);
  const uid = uidRef.current;
  const currentStep = steps[step];
  const prevStepRef = useRef(step);

  // Debug-mode override state — keyed by step index so edits to step N
  // survive navigating away and coming back.
  const [overrides, setOverrides] = useState<Record<number, ArrowPoint>>({});
  const [styleOverrides, setStyleOverrides] = useState<Record<number, ArrowStyle>>({});
  const [circleOverrides, setCircleOverrides] = useState<Record<number, TutorialCircle[]>>({});
  const [dragging, setDragging] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Arrow — refs avoid re-rendering on every scroll/resize pixel tick,
  // so the overlay stays 60 fps even over complex host pages.
  const [relPoint, setRelPoint] = useState<ArrowPoint | null>(null);
  const arrowPathRef = useRef<SVGPathElement>(null);
  const arrowLabelRef = useRef<SVGTextElement>(null);
  const arrowHandleRef = useRef<HTMLDivElement>(null);
  const arrowVisibleRef = useRef(false);
  const arrowSvgRef = useRef<SVGSVGElement>(null);

  // Step transition fade
  const [bodyVisible, setBodyVisible] = useState(true);
  const [displayStep, setDisplayStep] = useState(step);

  useEffect(() => {
    if (step === prevStepRef.current) return;
    prevStepRef.current = step;
    setBodyVisible(false);
    const t = setTimeout(() => {
      setDisplayStep(step);
      setBodyVisible(true);
    }, 80);
    return () => clearTimeout(t);
  }, [step]);

  // Resolved style has to be a ref too so the scroll handler can read the
  // latest style without retaking a closure every render.
  const resolvedStyleRef = useRef<Required<ArrowStyle>>(DEFAULT_STYLE);

  /** Direct DOM update — no setState, no re-render. Used by scroll/resize. */
  const syncArrowDOM = useCallback(() => {
    const cs = steps[step];
    // Hide the arrow if this step draws circles — the circle connectors
    // replace the arrow so we don't draw both.
    const hasCircles = (circleOverrides[step] ?? cs?.circles)?.length;
    if (!cs?.target || !cardRef.current || hasCircles) {
      if (arrowSvgRef.current) arrowSvgRef.current.style.display = "none";
      if (arrowHandleRef.current) arrowHandleRef.current.style.display = "none";
      arrowVisibleRef.current = false;
      return;
    }

    const pt: ArrowPoint = overrides[step] ?? cs.arrowTo ?? autoTargetPoint();
    const tipPx = resolvePoint(pt, cs.target);
    if (!tipPx) {
      if (arrowSvgRef.current) arrowSvgRef.current.style.display = "none";
      if (arrowHandleRef.current) arrowHandleRef.current.style.display = "none";
      arrowVisibleRef.current = false;
      return;
    }

    const src = cardSourcePx(cardRef.current);
    const d = buildPath(src.x, src.y, tipPx.x, tipPx.y, resolvedStyleRef.current);

    if (arrowPathRef.current) arrowPathRef.current.setAttribute("d", d);
    if (arrowLabelRef.current) {
      arrowLabelRef.current.setAttribute("x", String(tipPx.x));
      arrowLabelRef.current.setAttribute("y", String(tipPx.y + 14));
    }
    if (arrowHandleRef.current) {
      arrowHandleRef.current.style.left = `${tipPx.x}px`;
      arrowHandleRef.current.style.top = `${tipPx.y}px`;
    }
    if (arrowSvgRef.current) arrowSvgRef.current.style.display = "";
    if (arrowHandleRef.current && debug) arrowHandleRef.current.style.display = "";
    arrowVisibleRef.current = true;
  }, [step, steps, overrides, debug, circleOverrides]);

  /** Full update — sets state for step changes, then syncs DOM. */
  const updateArrow = useCallback(() => {
    const cs = steps[step];
    if (!cs?.target || !cardRef.current) {
      setRelPoint(null);
      return;
    }
    const pt: ArrowPoint = overrides[step] ?? cs.arrowTo ?? autoTargetPoint();
    setRelPoint(pt);
    resolvedStyleRef.current = {
      ...DEFAULT_STYLE,
      ...cs.arrowStyle,
      ...styleOverrides[step],
    };
    requestAnimationFrame(() => syncArrowDOM());
  }, [step, steps, overrides, styleOverrides, syncArrowDOM]);

  useEffect(() => {
    document
      .querySelectorAll("[data-tutorial-id]")
      .forEach((el) => el.classList.remove("tutorial-highlight"));
    if (currentStep?.target) {
      const t = document.querySelector(`[data-tutorial-id="${currentStep.target}"]`);
      if (t) t.classList.add("tutorial-highlight");
    }
    if (currentStep?.action && onAction) onAction(currentStep.action, step);
    const raf = requestAnimationFrame(() => updateArrow());
    return () => cancelAnimationFrame(raf);
  }, [step, currentStep, updateArrow, onAction]);

  // Scroll + resize — direct DOM updates, no re-render.
  useEffect(() => {
    const h = () => syncArrowDOM();
    window.addEventListener("scroll", h, true);
    window.addEventListener("resize", h);
    return () => {
      window.removeEventListener("scroll", h, true);
      window.removeEventListener("resize", h);
    };
  }, [syncArrowDOM]);

  // Re-sync when overrides change (from debug panel).
  useEffect(() => {
    syncArrowDOM();
  }, [overrides, styleOverrides, syncArrowDOM]);

  // Cleanup target highlights on unmount.
  useEffect(() => {
    return () => {
      document
        .querySelectorAll("[data-tutorial-id]")
        .forEach((el) => el.classList.remove("tutorial-highlight"));
    };
  }, []);

  // ── Debug: arrow tip drag ──────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const target = currentStep?.target;
      if (!target) return;
      setDragging(true);
      const onMove = (ev: MouseEvent) => {
        const rel = pixelToRelative({ x: ev.clientX, y: ev.clientY }, target);
        if (rel) {
          setOverrides((prev) => ({ ...prev, [step]: rel }));
          // Immediate DOM sync — don't wait for React.
          if (arrowHandleRef.current) {
            arrowHandleRef.current.style.left = `${ev.clientX}px`;
            arrowHandleRef.current.style.top = `${ev.clientY}px`;
          }
          if (arrowPathRef.current && cardRef.current) {
            const src = cardSourcePx(cardRef.current);
            arrowPathRef.current.setAttribute(
              "d",
              buildPath(src.x, src.y, ev.clientX, ev.clientY, resolvedStyleRef.current),
            );
          }
          if (arrowLabelRef.current) {
            arrowLabelRef.current.setAttribute("x", String(ev.clientX));
            arrowLabelRef.current.setAttribute("y", String(ev.clientY + 14));
          }
        }
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [step, currentStep],
  );

  /**
   * Build a serialisable step list that folds overrides into the base
   * steps. Only the known, library-managed fields are normalised; any
   * extra metadata from the host app is passed through untouched via
   * the index signature on `TutorialStep`.
   */
  const buildCleanSteps = useCallback((): TutorialStep[] => {
    return steps.map((s, i) => {
      // Start by passing through every field the host attached — this is
      // what lets apps carry their own metadata (highlights, filters,
      // colour modes, etc.) without the library knowing about them.
      const clean: TutorialStep = { ...s };
      if (overrides[i]) {
        clean.arrowTo = {
          x: Math.round(overrides[i].x * 10) / 10,
          y: Math.round(overrides[i].y * 10) / 10,
        };
      }
      const mergedStyle = { ...s.arrowStyle, ...styleOverrides[i] };
      if (Object.keys(mergedStyle).length > 0) clean.arrowStyle = mergedStyle;
      else delete clean.arrowStyle;
      const circles = circleOverrides[i] ?? s.circles;
      if (circles && circles.length > 0) {
        clean.circles = circles.map((c) => ({
          x: Math.round(c.x * 10) / 10,
          y: Math.round(c.y * 10) / 10,
          r: Math.round(c.r * 10) / 10,
          ...(c.ry != null ? { ry: Math.round(c.ry * 10) / 10 } : {}),
          ...(c.rot ? { rot: Math.round(c.rot) } : {}),
          ...(c.label ? { label: c.label } : {}),
        }));
      } else {
        delete clean.circles;
      }
      // Normalise Set-valued custom fields to arrays so they round-trip
      // through JSON. Pure passthrough for everything else.
      for (const key of Object.keys(clean)) {
        const v = clean[key];
        if (v instanceof Set) {
          clean[key] = Array.from(v);
        }
      }
      return clean;
    });
  }, [steps, overrides, styleOverrides, circleOverrides]);

  const savePositions = useCallback(async () => {
    const output = buildCleanSteps();
    setSaveState("saving");
    try {
      if (onSave) {
        await onSave(output);
      } else {
        // No save handler — fall back to clipboard so the user at least
        // walks away with the JSON they just authored.
        await navigator.clipboard?.writeText(JSON.stringify(output, null, 2));
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      setOverrides({});
      setStyleOverrides({});
      setCircleOverrides({});
      onSaved?.();
    } catch {
      // Save failed — surface the JSON via clipboard as a fallback.
      try {
        await navigator.clipboard?.writeText(JSON.stringify(output, null, 2));
      } catch {
        // If even clipboard fails, there's nothing we can do silently.
      }
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }, [buildCleanSteps, onSave, onSaved]);

  if (!currentStep) return null;

  // ── Derived ──────────────────────────────────────────────────────────

  const arrowColor = isDark ? "#a0a0a0" : "#404040";
  const arrowOpacity = isDark ? 0.45 : 0.35;
  const resolvedStyle: Required<ArrowStyle> = {
    ...DEFAULT_STYLE,
    ...currentStep.arrowStyle,
    ...styleOverrides[step],
  };
  resolvedStyleRef.current = resolvedStyle;
  const displayed = steps[displayStep] ?? currentStep;
  const unsaved =
    Object.keys(overrides).length +
    Object.keys(styleOverrides).length +
    Object.keys(circleOverrides).length;

  const cardClass = `nto-card${isDark ? " nto-dark" : ""}`;

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Card ── */}
      <div ref={cardRef} className={cardClass}>
        {/* Header */}
        <div className="nto-header">
          <div className="nto-header-left">
            {logoSrc && (
              <ImageComponent
                src={logoSrc}
                alt=""
                width={logoWidth}
                height={logoHeight}
                style={{ filter: isDark ? "invert(1) brightness(1.5)" : "none" }}
              />
            )}
            <span className="nto-header-label">{headerLabel}</span>
            <span className="nto-header-count">
              {step + 1}/{steps.length}
            </span>
          </div>
          <div className="nto-header-right">
            {debug && (
              <button
                onClick={savePositions}
                disabled={saveState === "saving"}
                className="nto-btn"
              >
                {saveState === "saved" ? (
                  <Check style={{ width: 10, height: 10 }} />
                ) : (
                  <Copy style={{ width: 10, height: 10 }} />
                )}
                {saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                  ? "Clipboard"
                  : unsaved > 0
                  ? `Save ${unsaved}`
                  : "Save"}
              </button>
            )}
            <button onClick={onClose} className="nto-close" aria-label="Close tutorial">
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="nto-body">
          <div className={`nto-body-inner${bodyVisible ? "" : " nto-hidden"}`}>
            <h4 className="nto-title">{displayed.title}</h4>
            <p className="nto-copy">{displayed.body}</p>
          </div>
        </div>

        {/* Debug panel */}
        {debug && relPoint && currentStep.target && (
          <div className="nto-debug-panel">
            <div className="nto-debug-row">
              <span className="nto-debug-readout">
                {relPoint.x.toFixed(1)}%, {relPoint.y.toFixed(1)}% of {currentStep.target}
                {overrides[step] ? " •" : ""}
              </span>
              {unsaved > 0 && <span className="nto-debug-dirty">{unsaved}Δ</span>}
            </div>
            <div className="nto-debug-grid">
              <label className="nto-debug-slider">
                <span>bend</span>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={1}
                  value={resolvedStyle.bend}
                  onChange={(e) =>
                    setStyleOverrides((prev) => ({
                      ...prev,
                      [step]: { ...prev[step], bend: +e.target.value },
                    }))
                  }
                />
                <span>{resolvedStyle.bend}</span>
              </label>
              <label className="nto-debug-slider">
                <span>wt</span>
                <input
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.25}
                  value={resolvedStyle.strokeWidth}
                  onChange={(e) =>
                    setStyleOverrides((prev) => ({
                      ...prev,
                      [step]: { ...prev[step], strokeWidth: +e.target.value },
                    }))
                  }
                />
                <span>{resolvedStyle.strokeWidth}</span>
              </label>
              <label className="nto-debug-slider">
                <span>head</span>
                <input
                  type="range"
                  min={4}
                  max={16}
                  step={1}
                  value={resolvedStyle.headSize}
                  onChange={(e) =>
                    setStyleOverrides((prev) => ({
                      ...prev,
                      [step]: { ...prev[step], headSize: +e.target.value },
                    }))
                  }
                />
                <span>{resolvedStyle.headSize}</span>
              </label>
              <div className="nto-debug-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={resolvedStyle.flip}
                    onChange={(e) =>
                      setStyleOverrides((prev) => ({
                        ...prev,
                        [step]: { ...prev[step], flip: e.target.checked },
                      }))
                    }
                  />
                  <span>flip</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={resolvedStyle.dashed}
                    onChange={(e) =>
                      setStyleOverrides((prev) => ({
                        ...prev,
                        [step]: { ...prev[step], dashed: e.target.checked },
                      }))
                    }
                  />
                  <span>dash</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={resolvedStyle.loopEnd}
                    onChange={(e) =>
                      setStyleOverrides((prev) => ({
                        ...prev,
                        [step]: { ...prev[step], loopEnd: e.target.checked },
                      }))
                    }
                  />
                  <span>loop</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="nto-footer">
          {/* Segmented progress bar */}
          <div className="nto-progress">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => onStepChange(i)}
                className="nto-progress-seg"
                aria-label={`Go to step ${i + 1}`}
                style={{
                  backgroundColor:
                    i === step
                      ? "var(--nto-accent)"
                      : i < step
                      ? isDark
                        ? "rgba(255,255,255,0.25)"
                        : "rgba(0,0,0,0.18)"
                      : isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.06)",
                }}
              />
            ))}
          </div>

          {/* Nav */}
          <div className="nto-nav">
            <span className="nto-nav-count">
              {step + 1} of {steps.length}
            </span>
            <div className="nto-nav-actions">
              {step > 0 && (
                <button onClick={() => onStepChange(step - 1)} className="nto-nav-back">
                  <ChevronLeft style={{ width: 12, height: 12 }} /> Back
                </button>
              )}
              {step < steps.length - 1 ? (
                <button onClick={() => onStepChange(step + 1)} className="nto-nav-next">
                  Next <ChevronRight style={{ width: 12, height: 12 }} />
                </button>
              ) : (
                <button onClick={onClose} className="nto-nav-next nto-nav-done">
                  Done <ChevronRight style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Arrow (always mounted; updated via refs) ── */}
      {currentStep?.target &&
        (() => {
          const hs = resolvedStyle.headSize;
          const isLoop = resolvedStyle.loopEnd;
          const loopR = hs * 0.5;
          return (
            <svg
              ref={arrowSvgRef}
              className="nto-arrow-svg"
              style={{ display: arrowVisibleRef.current ? "" : "none" }}
            >
              <defs>
                <marker
                  id={`${uid}-head`}
                  markerWidth={hs}
                  markerHeight={hs * 0.75}
                  refX={hs - 1}
                  refY={hs * 0.375}
                  orient="auto"
                >
                  <path
                    d={`M0,0.5 L${hs - 1},${hs * 0.375} L0,${hs * 0.75 - 0.5}`}
                    fill="none"
                    stroke={arrowColor}
                    strokeWidth="1"
                    strokeOpacity={arrowOpacity}
                  />
                </marker>
                <marker
                  id={`${uid}-loop`}
                  markerWidth={loopR * 2.5}
                  markerHeight={loopR * 2.5}
                  refX={loopR * 1.25}
                  refY={loopR * 1.25}
                  orient="auto"
                >
                  <ellipse
                    cx={loopR * 1.25}
                    cy={loopR * 1.25}
                    rx={loopR}
                    ry={loopR * 0.7}
                    fill="none"
                    stroke={arrowColor}
                    strokeWidth="1"
                    strokeOpacity={arrowOpacity}
                  />
                </marker>
              </defs>
              <path
                ref={arrowPathRef}
                d=""
                fill="none"
                stroke={arrowColor}
                strokeOpacity={arrowOpacity}
                strokeWidth={resolvedStyle.strokeWidth}
                strokeDasharray={resolvedStyle.dashed ? "5,3" : "1000"}
                markerEnd={isLoop ? `url(#${uid}-loop)` : `url(#${uid}-head)`}
                style={{
                  animation: resolvedStyle.dashed
                    ? "nto-arrow-pulse 2.5s ease-in-out infinite"
                    : "nto-arrow-draw 0.8s ease-out forwards, nto-arrow-pulse 2.5s ease-in-out 0.8s infinite",
                }}
              />
              {currentStep.targetLabel && (
                <text
                  ref={arrowLabelRef}
                  x="0"
                  y="0"
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="600"
                  fill={arrowColor}
                  fillOpacity={0.7}
                  letterSpacing="0.03em"
                  style={{ animation: "nto-arrow-draw 0.8s ease-out forwards" }}
                >
                  {currentStep.targetLabel}
                </text>
              )}
            </svg>
          );
        })()}

      {/* ── Debug handle (arrow tip drag) ── */}
      {debug && currentStep?.target && (
        <div
          ref={arrowHandleRef}
          className="nto-debug-handle"
          style={{ display: arrowVisibleRef.current ? "" : "none" }}
          onMouseDown={handleDragStart}
        >
          <div
            className={`nto-debug-handle-dot${dragging ? " nto-dragging" : ""}${
              overrides[step] || styleOverrides[step] ? " nto-dirty" : ""
            }`}
          />
          <span
            className={`nto-debug-handle-label${
              overrides[step] || styleOverrides[step] ? " nto-dirty" : ""
            }`}
          >
            {overrides[step] || styleOverrides[step] ? "Δ" : "↕"}
          </span>
        </div>
      )}

      {/* ── Circles (line from card → ellipse around target region) ── */}
      {currentStep?.target &&
        (() => {
          const circles = circleOverrides[step] ?? currentStep.circles;
          if (!circles || circles.length === 0) return null;
          const targetEl = document.querySelector(
            `[data-tutorial-id="${currentStep.target}"]`,
          );
          if (!targetEl || !cardRef.current) return null;
          const tr = targetEl.getBoundingClientRect();
          const cardRect = cardRef.current.getBoundingClientRect();
          const cColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
          const srcX = cardRect.left + cardRect.width / 2;
          const srcY = cardRect.top;

          return (
            <>
              <svg className="nto-circles-svg" key={`circles-${step}`}>
                {circles.map((c, i) => {
                  const cx = tr.left + tr.width * (c.x / 100);
                  const cy = tr.top + tr.height * (c.y / 100);
                  const rx = tr.width * (c.r / 100);
                  const ry = c.ry != null ? tr.height * (c.ry / 100) : rx;
                  const rot = c.rot ?? 0;

                  // Direction from card to circle centre.
                  const dx = cx - srcX;
                  const dy = cy - srcY;
                  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                  const nx = dx / dist;
                  const ny = dy / dist;
                  // Ellipse-edge intersection, accounting for rotation.
                  const rad = (rot * Math.PI) / 180;
                  const cosR = Math.cos(-rad);
                  const sinR = Math.sin(-rad);
                  const lnx = nx * cosR - ny * sinR;
                  const lny = nx * sinR + ny * cosR;
                  const edgeDist =
                    rx > 0 && ry > 0
                      ? 1 / Math.sqrt((lnx * lnx) / (rx * rx) + (lny * lny) / (ry * ry))
                      : 0;
                  const edgeX = cx - nx * edgeDist;
                  const edgeY = cy - ny * edgeDist;
                  // Subtle perpendicular curve on the connector line.
                  const perpX = -ny;
                  const perpY = nx;
                  const cpX = (srcX + edgeX) / 2 + perpX * 20;
                  const cpY = (srcY + edgeY) / 2 + perpY * 20;

                  const delay = i * 0.15;
                  return (
                    <g key={i}>
                      <path
                        d={`M${srcX},${srcY} Q${cpX},${cpY} ${edgeX},${edgeY}`}
                        fill="none"
                        stroke={cColor}
                        strokeWidth="0.8"
                        strokeDasharray="800"
                        style={{ animation: `nto-line-in 0.5s ${delay}s ease-out both` }}
                      />
                      <ellipse
                        cx={cx}
                        cy={cy}
                        rx={rx}
                        ry={ry}
                        fill="none"
                        stroke={cColor}
                        strokeWidth="1"
                        strokeDasharray="400"
                        transform={rot ? `rotate(${rot}, ${cx}, ${cy})` : undefined}
                        style={{
                          animation: `nto-ellipse-in 0.5s ${delay + 0.3}s ease-out both`,
                        }}
                      />
                      {c.label && (
                        <text
                          x={cx}
                          y={cy + ry + 12}
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="500"
                          fill={cColor}
                          style={{
                            animation: `nto-label-in 0.3s ${delay + 0.5}s ease-out both`,
                          }}
                        >
                          {c.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Debug handles for circles */}
              {debug &&
                circles.map((c, i) => {
                  const cx = tr.left + tr.width * (c.x / 100);
                  const cy = tr.top + tr.height * (c.y / 100);
                  const rx = tr.width * (c.r / 100);
                  const ry = c.ry != null ? tr.height * (c.ry / 100) : rx;
                  const rot = c.rot ?? 0;
                  const rad = (rot * Math.PI) / 180;

                  const onCenterDrag = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const onMove = (ev: MouseEvent) => {
                      setCircleOverrides((prev) => {
                        const arr = [...(prev[step] ?? circles)];
                        arr[i] = {
                          ...arr[i],
                          x: ((ev.clientX - tr.left) / tr.width) * 100,
                          y: ((ev.clientY - tr.top) / tr.height) * 100,
                        };
                        return { ...prev, [step]: arr };
                      });
                    };
                    const onUp = () => {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  };
                  const onRxDrag = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const onMove = (ev: MouseEvent) => {
                      const dx = ev.clientX - cx;
                      const dy = ev.clientY - cy;
                      const cosR = Math.cos(-rad);
                      const sinR = Math.sin(-rad);
                      const localX = Math.abs(dx * cosR - dy * sinR);
                      setCircleOverrides((prev) => {
                        const arr = [...(prev[step] ?? circles)];
                        arr[i] = { ...arr[i], r: Math.max(1, (localX / tr.width) * 100) };
                        return { ...prev, [step]: arr };
                      });
                    };
                    const onUp = () => {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  };
                  const onRyDrag = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const onMove = (ev: MouseEvent) => {
                      const dx = ev.clientX - cx;
                      const dy = ev.clientY - cy;
                      const cosR = Math.cos(-rad);
                      const sinR = Math.sin(-rad);
                      const localY = Math.abs(dx * sinR + dy * cosR);
                      setCircleOverrides((prev) => {
                        const arr = [...(prev[step] ?? circles)];
                        arr[i] = { ...arr[i], ry: Math.max(1, (localY / tr.height) * 100) };
                        return { ...prev, [step]: arr };
                      });
                    };
                    const onUp = () => {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  };
                  const onRotDrag = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const onMove = (ev: MouseEvent) => {
                      const angle =
                        Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI);
                      setCircleOverrides((prev) => {
                        const arr = [...(prev[step] ?? circles)];
                        arr[i] = { ...arr[i], rot: Math.round(angle) };
                        return { ...prev, [step]: arr };
                      });
                    };
                    const onUp = () => {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  };

                  const rxHx = cx + rx * Math.cos(rad);
                  const rxHy = cy + rx * Math.sin(rad);
                  const ryHx = cx - ry * Math.sin(rad);
                  const ryHy = cy + ry * Math.cos(rad);
                  const rotHx = cx + (rx + 12) * Math.cos(rad - 0.3);
                  const rotHy = cy + (rx + 12) * Math.sin(rad - 0.3);

                  const hStyle: React.CSSProperties = {
                    position: "fixed",
                    zIndex: 60,
                    transform: "translate(-50%, -50%)",
                  };
                  return (
                    <React.Fragment key={`ch-${i}`}>
                      <div
                        style={{ ...hStyle, left: cx, top: cy, cursor: "move" }}
                        onMouseDown={onCenterDrag}
                      >
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 9999,
                            border: "1.5px solid #a855f7",
                            background: "rgba(168,85,247,0.15)",
                          }}
                        />
                      </div>
                      <div
                        style={{ ...hStyle, left: rxHx, top: rxHy, cursor: "ew-resize" }}
                        onMouseDown={onRxDrag}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            border: "1.5px solid #a855f7",
                            background: "rgba(168,85,247,0.15)",
                          }}
                        />
                      </div>
                      <div
                        style={{ ...hStyle, left: ryHx, top: ryHy, cursor: "ns-resize" }}
                        onMouseDown={onRyDrag}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            border: "1.5px solid #a855f7",
                            background: "rgba(168,85,247,0.15)",
                            transform: "rotate(45deg)",
                          }}
                        />
                      </div>
                      <div
                        style={{ ...hStyle, left: rotHx, top: rotHy, cursor: "grab" }}
                        onMouseDown={onRotDrag}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 9999,
                            border: "1.5px solid #fb923c",
                            background: "rgba(251,146,60,0.15)",
                          }}
                        />
                      </div>
                    </React.Fragment>
                  );
                })}
            </>
          );
        })()}
    </>
  );
}
