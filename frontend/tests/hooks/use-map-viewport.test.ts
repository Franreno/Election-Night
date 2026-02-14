import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapViewport } from "@/hooks/use-map-viewport";

describe("useMapViewport", () => {
  const baseOptions = { baseWidth: 800, baseHeight: 600 };

  it("initializes with base viewport", () => {
    const { result } = renderHook(() => useMapViewport(baseOptions));

    expect(result.current.viewport).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
    expect(result.current.zoom).toBe(1);
  });

  it("returns handlers object", () => {
    const { result } = renderHook(() => useMapViewport(baseOptions));

    expect(result.current.handlers).toHaveProperty("onWheel");
    expect(result.current.handlers).toHaveProperty("onPointerDown");
    expect(result.current.handlers).toHaveProperty("onPointerMove");
    expect(result.current.handlers).toHaveProperty("onPointerUp");
  });

  it("provides zoom control functions", () => {
    const { result } = renderHook(() => useMapViewport(baseOptions));

    expect(typeof result.current.zoomIn).toBe("function");
    expect(typeof result.current.zoomOut).toBe("function");
    expect(typeof result.current.resetView).toBe("function");
    expect(typeof result.current.zoomToArea).toBe("function");
  });

  it("provides svgRef", () => {
    const { result } = renderHook(() => useMapViewport(baseOptions));
    expect(result.current.svgRef).toBeDefined();
    expect(result.current.svgRef.current).toBeNull();
  });

  it("calculates zoom as ratio of baseWidth to viewport width", () => {
    const { result } = renderHook(() => useMapViewport(baseOptions));
    // At initial state, zoom = 800 / 800 = 1
    expect(result.current.zoom).toBe(1);
  });

  it("provides wasDrag ref", () => {
    const { result } = renderHook(() => useMapViewport(baseOptions));
    expect(result.current.wasDrag).toBeDefined();
    expect(result.current.wasDrag.current).toBe(false);
  });
});
