"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { useConstituenciesSummary } from "@/hooks/use-constituencies-summary";
import { useMapViewport } from "@/hooks/use-map-viewport";
import {
  buildConstituencyLookup,
  matchConstituency,
  getConstituencyColor,
} from "@/lib/map-utils";
import type { ConstituencyMapEntry } from "@/lib/map-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapTooltip } from "./map-tooltip";
import { MapLegend } from "./map-legend";
import { MapControls } from "./map-controls";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOPOJSON_URL = `${API_BASE}/static/uk-constituencies.topojson`;

interface TooltipState {
  x: number;
  y: number;
  name: string;
  partyCode: string | null;
  regionName?: string | null;
}

const MAP_WIDTH = 500;
const MAP_HEIGHT = 820;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConstituencyMap() {
  const router = useRouter();
  const { data: summaryData } = useConstituenciesSummary();
  const [topology, setTopology] = useState<Topology | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const {
    viewport,
    zoom,
    svgRef,
    wasDrag,
    handlers,
    zoomIn,
    zoomOut,
    resetView,
  } = useMapViewport({
    baseWidth: MAP_WIDTH,
    baseHeight: MAP_HEIGHT,
  });

  useEffect(() => {
    fetch(TOPOJSON_URL)
      .then((res) => res.json())
      .then(setTopology)
      .catch(() => {});
  }, []);

  const geojson = useMemo<FeatureCollection | null>(() => {
    if (!topology) return null;
    const layerName = Object.keys(topology.objects)[0];
    return feature(topology, topology.objects[layerName]) as FeatureCollection;
  }, [topology]);

  const lookup = useMemo(() => {
    if (!summaryData) return new Map<string, ConstituencyMapEntry>();
    return buildConstituencyLookup(summaryData.constituencies);
  }, [summaryData]);

  const pathGenerator = useMemo(() => {
    if (!geojson) return null;
    const projection = geoMercator().fitSize([MAP_WIDTH, MAP_HEIGHT], geojson);
    return geoPath(projection);
  }, [geojson]);

  const paths = useMemo(() => {
    if (!geojson || !pathGenerator) return [];
    return geojson.features.map((feat) => ({
      feat,
      d: pathGenerator(feat.geometry) ?? "",
    }));
  }, [geojson, pathGenerator]);

  const activeParties = useMemo(() => {
    if (!summaryData) return [];
    const parties = new Set<string>();
    for (const c of summaryData.constituencies) {
      if (c.winning_party_code) parties.add(c.winning_party_code);
    }
    return Array.from(parties).sort();
  }, [summaryData]);

  const findMatch = useCallback(
    (feat: Feature<Geometry>) => {
      const code = feat.properties?.pcon19cd ?? "";
      const name = feat.properties?.pcon19nm ?? "";
      return lookup.get(code) ?? matchConstituency(name, lookup);
    },
    [lookup],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, feat: Feature<Geometry>) => {
      const name = feat.properties?.pcon19nm ?? "Unknown";
      const match = findMatch(feat);
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        name: match?.name ?? name,
        partyCode: match?.winning_party_code ?? null,
        regionName: match?.region_name,
      });
    },
    [findMatch],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip((prev) =>
      prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
    );
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleClick = useCallback(
    (feat: Feature<Geometry>) => {
      if (wasDrag.current) return;
      const match = findMatch(feat);
      if (match) {
        router.push(`/constituencies/${match.id}`);
      }
    },
    [findMatch, router, wasDrag],
  );

  if (!topology || !geojson || !pathGenerator || paths.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Constituency Map</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[500px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Constituency Map</CardTitle>
      </CardHeader>
      <CardContent>
        <MapLegend activeParties={activeParties} />
        <div className="relative mt-3">
          <MapControls
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetView}
            zoom={zoom}
          />
          <svg
            ref={svgRef}
            viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
            className="w-full cursor-grab active:cursor-grabbing"
            style={{ maxHeight: "70vh", touchAction: "none" }}
            {...handlers}
          >
            {paths.map(({ feat, d }, i) => {
              const match = findMatch(feat);
              const color = getConstituencyColor(match?.winning_party_code);
              return (
                <path
                  key={feat.properties?.pcon19cd ?? i}
                  d={d}
                  fill={color}
                  stroke="#1a1a1e"
                  strokeWidth={0.3 / zoom}
                  className="transition-opacity hover:opacity-80"
                  onMouseEnter={(e) => handleMouseEnter(e, feat)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleClick(feat)}
                />
              );
            })}
          </svg>
          {tooltip && (
            <MapTooltip
              x={tooltip.x}
              y={tooltip.y}
              name={tooltip.name}
              partyCode={tooltip.partyCode}
              regionName={tooltip.regionName}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
