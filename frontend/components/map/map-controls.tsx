import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
  zoom,
  minZoom = 1,
  maxZoom = 8,
}: MapControlsProps) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-md bg-card/80 p-1 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        aria-label="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <span className="text-center text-[10px] text-muted-foreground">
        {zoom.toFixed(1)}x
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        aria-label="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onReset}
        disabled={zoom <= minZoom + 0.01}
        aria-label="Reset view"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
