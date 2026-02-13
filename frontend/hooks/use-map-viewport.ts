import { useCallback, useRef, useState } from "react";

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseMapViewportOptions {
  baseWidth: number;
  baseHeight: number;
  minZoom?: number;
  maxZoom?: number;
}

const ZOOM_STEP = 1.25;
const ANIM_DURATION = 350;

// ---------------------------------------------------------------------------
// Cubic Bézier easing — equivalent to CSS cubic-bezier(0.4, 0, 0.2, 1)
// (Material Design "standard" ease-out). Solved via Newton-Raphson.
// ---------------------------------------------------------------------------

function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  function sampleX(t: number) {
    return ((ax * t + bx) * t + cx) * t;
  }
  function sampleY(t: number) {
    return ((ay * t + by) * t + cy) * t;
  }
  function sampleDerivX(t: number) {
    return (3 * ax * t + 2 * bx) * t + cx;
  }

  // Newton-Raphson to solve x(t) = x for t
  function solveTForX(x: number) {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) break;
      const d = sampleDerivX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return t;
  }

  return (x: number) => sampleY(solveTForX(x));
}

const easeOutCubicBezier = cubicBezier(0.4, 0, 0.2, 1);

export function useMapViewport({
  baseWidth,
  baseHeight,
  minZoom = 1,
  maxZoom = 8,
}: UseMapViewportOptions) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    width: baseWidth,
    height: baseHeight,
  });

  const zoom = baseWidth / viewport.width;

  // --- Coordinate conversion ---

  const screenToSvg = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const inv = ctm.inverse();
      return [
        clientX * inv.a + clientY * inv.c + inv.e,
        clientX * inv.b + clientY * inv.d + inv.f,
      ];
    },
    [],
  );

  // --- Clamping ---

  const clamp = useCallback(
    (vp: Viewport): Viewport => {
      const w = Math.max(baseWidth / maxZoom, Math.min(baseWidth / minZoom, vp.width));
      const h = (w / baseWidth) * baseHeight;
      let x = vp.x;
      let y = vp.y;
      // Keep viewport within bounds
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x + w > baseWidth) x = baseWidth - w;
      if (y + h > baseHeight) y = baseHeight - h;
      return { x, y, width: w, height: h };
    },
    [baseWidth, baseHeight, minZoom, maxZoom],
  );

  // --- Animation ---

  const animRef = useRef<number | null>(null);

  const wheelAnimCancelRef = useRef<(() => void) | null>(null);

  const cancelAnimation = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    // Also cancel any in-flight wheel animation
    wheelAnimCancelRef.current?.();
  }, []);

  const animateTo = useCallback(
    (target: Viewport) => {
      cancelAnimation();
      const clamped = clamp(target);
      let start: number | null = null;
      let startVp: Viewport | null = null;

      const step = (timestamp: number) => {
        if (start === null) {
          start = timestamp;
          // Capture current viewport at animation start
          setViewport((current) => {
            startVp = current;
            return current;
          });
        }
        if (!startVp) {
          // Wait one more frame for startVp to be captured
          animRef.current = requestAnimationFrame(step);
          return;
        }
        const t = Math.min(1, (timestamp - start) / ANIM_DURATION);
        const ease = easeOutCubicBezier(t);
        setViewport({
          x: startVp.x + (clamped.x - startVp.x) * ease,
          y: startVp.y + (clamped.y - startVp.y) * ease,
          width: startVp.width + (clamped.width - startVp.width) * ease,
          height: startVp.height + (clamped.height - startVp.height) * ease,
        });
        if (t < 1) {
          animRef.current = requestAnimationFrame(step);
        } else {
          animRef.current = null;
        }
      };
      animRef.current = requestAnimationFrame(step);
    },
    [clamp, cancelAnimation],
  );

  // --- Wheel zoom (smooth exponential decay) ---
  //
  // Each wheel tick nudges a target viewport. A rAF loop smoothly chases it
  // using exponential interpolation (lerp per frame), so continuous scrolling
  // feels fluid and the map "glides" to a stop when the user stops scrolling.

  const wheelTarget = useRef<Viewport | null>(null);
  const wheelAnimRef = useRef<number | null>(null);

  const WHEEL_LERP = 0.25; // fraction of remaining distance per frame
  const WHEEL_SNAP_THRESHOLD = 0.1; // px — close enough to snap

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const point = screenToSvg(e.clientX, e.clientY);
      if (!point) return;
      const [svgX, svgY] = point;

      const WHEEL_ZOOM_STEP = 1.1;
      const factor = e.deltaY > 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP;

      // Accumulate: start from existing target (if chasing) or current viewport
      setViewport((currentVp) => {
        const base = wheelTarget.current ?? currentVp;
        const newW = base.width / factor;
        const newH = base.height / factor;
        const newX = svgX - (svgX - base.x) / factor;
        const newY = svgY - (svgY - base.y) / factor;
        wheelTarget.current = clamp({ x: newX, y: newY, width: newW, height: newH });
        return currentVp;
      });

      // Start chase loop if not already running
      if (wheelAnimRef.current !== null) return;

      cancelAnimation(); // cancel button/reset animations

      wheelAnimCancelRef.current = () => {
        if (wheelAnimRef.current !== null) {
          cancelAnimationFrame(wheelAnimRef.current);
          wheelAnimRef.current = null;
        }
        wheelTarget.current = null;
      };

      const chase = () => {
        const target = wheelTarget.current;
        if (!target) {
          wheelAnimRef.current = null;
          return;
        }

        setViewport((vp) => {
          const dx = target.x - vp.x;
          const dy = target.y - vp.y;
          const dw = target.width - vp.width;
          const dh = target.height - vp.height;

          // Close enough — snap and stop
          if (Math.abs(dw) < WHEEL_SNAP_THRESHOLD && Math.abs(dx) < WHEEL_SNAP_THRESHOLD) {
            wheelTarget.current = null;
            return target;
          }

          return {
            x: vp.x + dx * WHEEL_LERP,
            y: vp.y + dy * WHEEL_LERP,
            width: vp.width + dw * WHEEL_LERP,
            height: vp.height + dh * WHEEL_LERP,
          };
        });

        if (wheelTarget.current) {
          wheelAnimRef.current = requestAnimationFrame(chase);
        } else {
          wheelAnimRef.current = null;
        }
      };

      wheelAnimRef.current = requestAnimationFrame(chase);
    },
    [screenToSvg, clamp, cancelAnimation],
  );

  // --- Pointer drag pan ---

  const dragState = useRef<{
    startSvg: [number, number];
    startViewport: Viewport;
    startScreen: [number, number];
    startTime: number;
    pointerId: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return; // left button only
      cancelAnimation();

      const point = screenToSvg(e.clientX, e.clientY);
      if (!point) return;

      dragState.current = {
        startSvg: point,
        startViewport: viewport,
        startScreen: [e.clientX, e.clientY],
        startTime: Date.now(),
        pointerId: e.pointerId,
      };

      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [screenToSvg, viewport, cancelAnimation],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragState.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const point = screenToSvg(e.clientX, e.clientY);
      if (!point) return;

      // Use screen delta converted to SVG scale for smoother panning
      const currentZoom = baseWidth / drag.startViewport.width;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = drag.startViewport.width / rect.width;
      const scaleY = drag.startViewport.height / rect.height;

      const dx = (e.clientX - drag.startScreen[0]) * scaleX;
      const dy = (e.clientY - drag.startScreen[1]) * scaleY;

      setViewport(
        clamp({
          x: drag.startViewport.x - dx,
          y: drag.startViewport.y - dy,
          width: drag.startViewport.width,
          height: drag.startViewport.height,
        }),
      );
    },
    [screenToSvg, clamp, baseWidth],
  );

  const wasDrag = useRef(false);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragState.current;
      if (!drag || drag.pointerId !== e.pointerId) {
        wasDrag.current = false;
        return;
      }

      const dx = Math.abs(e.clientX - drag.startScreen[0]);
      const dy = Math.abs(e.clientY - drag.startScreen[1]);
      const dt = Date.now() - drag.startTime;

      // If moved more than 5px or took longer than 200ms, it was a drag
      wasDrag.current = dx > 5 || dy > 5 || dt > 200;

      dragState.current = null;
      (e.target as Element).releasePointerCapture(e.pointerId);
    },
    [],
  );

  // --- Programmatic zoom (animated) ---

  const zoomIn = useCallback(() => {
    // Read current viewport synchronously via ref-like pattern
    setViewport((vp) => {
      const cx = vp.x + vp.width / 2;
      const cy = vp.y + vp.height / 2;
      const newW = vp.width / ZOOM_STEP;
      const newH = vp.height / ZOOM_STEP;
      // Schedule animation (will capture current viewport inside animateTo)
      animateTo({
        x: cx - newW / 2,
        y: cy - newH / 2,
        width: newW,
        height: newH,
      });
      return vp; // don't change yet — animateTo will handle it
    });
  }, [animateTo]);

  const zoomOut = useCallback(() => {
    setViewport((vp) => {
      const cx = vp.x + vp.width / 2;
      const cy = vp.y + vp.height / 2;
      const newW = vp.width * ZOOM_STEP;
      const newH = vp.height * ZOOM_STEP;
      animateTo({
        x: cx - newW / 2,
        y: cy - newH / 2,
        width: newW,
        height: newH,
      });
      return vp;
    });
  }, [animateTo]);

  const resetView = useCallback(() => {
    animateTo({ x: 0, y: 0, width: baseWidth, height: baseHeight });
  }, [animateTo, baseWidth, baseHeight]);

  const zoomToArea = useCallback(
    (bbox: { x: number; y: number; width: number; height: number }) => {
      // Add 20% padding
      const pad = 0.2;
      const padW = bbox.width * pad;
      const padH = bbox.height * pad;
      const target = {
        x: bbox.x - padW,
        y: bbox.y - padH,
        width: bbox.width + 2 * padW,
        height: bbox.height + 2 * padH,
      };
      // Maintain aspect ratio
      const aspect = baseWidth / baseHeight;
      const targetAspect = target.width / target.height;
      if (targetAspect > aspect) {
        // Wider than viewport — fit width, expand height
        const newH = target.width / aspect;
        target.y -= (newH - target.height) / 2;
        target.height = newH;
      } else {
        // Taller — fit height, expand width
        const newW = target.height * aspect;
        target.x -= (newW - target.width) / 2;
        target.width = newW;
      }
      animateTo(target);
    },
    [animateTo, baseWidth, baseHeight],
  );

  return {
    viewport,
    zoom,
    svgRef,
    wasDrag,
    handlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
    zoomIn,
    zoomOut,
    resetView,
    zoomToArea,
  };
}
