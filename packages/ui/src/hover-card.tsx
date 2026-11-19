"use client";

import { createElement, useRef, type AnchorHTMLAttributes, type HTMLAttributes, type PointerEvent } from "react";

type HoverCardProps = HTMLAttributes<HTMLElement> &
  Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target" | "rel"> & {
    /** Element to render; the card's own semantics stay those of this element. */
    as?: "div" | "article" | "a" | "li";
    /** Lean toward the pointer in 3D. Off for wide rows, where a tilt reads as wobble. */
    tilt?: boolean;
    "data-platform"?: string;
  };

/** Largest lean, in degrees, at the card's edges. */
const MAX_TILT = 5;

/**
 * A card that reacts to the pointer: it follows the cursor with a soft spotlight (--mx/--my) and, with `tilt`,
 * leans toward it (--rx/--ry). The look lives in styles.css (`.hover-card` and the `.hover-chip`, `.hover-check`
 * and `.hover-zoom` helpers for its children). Only a mouse drives it, and the tilt is skipped for visitors who
 * ask for reduced motion; on touch screens the card simply lifts on tap like any link.
 */
export function HoverCard({ as = "div", tilt = true, className = "", onPointerMove, onPointerLeave, ...rest }: HoverCardProps) {
  const frame = useRef(0);

  function move(event: PointerEvent<HTMLElement>) {
    onPointerMove?.(event);
    if (event.pointerType !== "mouse") return;
    const element = event.currentTarget;
    const box = element.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    const leans = tilt && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      element.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      element.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      if (leans) {
        element.style.setProperty("--ry", `${((x - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
        element.style.setProperty("--rx", `${((0.5 - y) * 2 * MAX_TILT).toFixed(2)}deg`);
      }
    });
  }

  function leave(event: PointerEvent<HTMLElement>) {
    onPointerLeave?.(event);
    cancelAnimationFrame(frame.current);
    const element = event.currentTarget;
    for (const name of ["--rx", "--ry"]) element.style.removeProperty(name);
  }

  return createElement(as, { ...rest, className: `hover-card ${className}`, onPointerMove: move, onPointerLeave: leave });
}
