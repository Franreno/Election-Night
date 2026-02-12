"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, Feature, Geometry, Position } from "geojson";
import { useConstituenciesSummary } from "@/hooks/use-constituencies-summary";
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOPOJSON_URL = `${API_BASE}/static/uk-constituencies.topojson`;

interface TooltipState {
  x: number;
  y: number;
  name: string;
  partyCode: string | null;
}

const MAP_WIDTH = 500;
const MAP_HEIGHT = 820;

// ---------------------------------------------------------------------------
// Lightweight Mercator projection (replaces d3-geo)
// ---------------------------------------------------------------------------

interface MercatorProjection {
  project: (lon: number, lat: number) => [number, number];
}

function computeBounds(fc: FeatureCollection): [[number, number], [number, number]] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

  function walk(coords: unknown) {
    if (typeof (coords as Position)[0] === "number" && typeof (coords as Position)[1] === "number" && !Array.isArray((coords as Position)[0])) {
      const [lon, lat] = coords as Position;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const c of coords as unknown[]) walk(c);
    }
  }

  for (const feat of fc.features) {
    if (feat.geometry && "coordinates" in feat.geometry) {
      walk(feat.geometry.coordinates);
    }
  }
  return [[minLon, minLat], [maxLon, maxLat]];
}

function mercatorRaw(lon: number, lat: number): [number, number] {
  const RAD = Math.PI / 180;
  const x = lon * RAD;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
  return [x, y];
}

function fitMercator(fc: FeatureCollection, width: number, height: number): MercatorProjection {
  const [[minLon, minLat], [maxLon, maxLat]] = computeBounds(fc);

  const [x0, y0] = mercatorRaw(minLon, maxLat); // top-left (y is flipped)
  const [x1, y1] = mercatorRaw(maxLon, minLat); // bottom-right

  const rawW = x1 - x0;
  const rawH = y1 - y0; // note: y0 > y1 because of Mercator

  const padding = 10;
  const availW = width - 2 * padding;
  const availH = height - 2 * padding;

  const scale = Math.min(availW / rawW, availH / Math.abs(rawH));

  const projW = rawW * scale;
  const projH = Math.abs(rawH) * scale;
  const offsetX = padding + (availW - projW) / 2;
  const offsetY = padding + (availH - projH) / 2;

  return {
    project(lon: number, lat: number): [number, number] {
      const [mx, my] = mercatorRaw(lon, lat);
      return [
        offsetX + (mx - x0) * scale,
        offsetY + (y0 - my) * scale, // flip y
      ];
    },
  };
}

// ---------------------------------------------------------------------------
// SVG path generation from GeoJSON geometry
// ---------------------------------------------------------------------------

function ringToPath(ring: Position[], proj: MercatorProjection): string {
  return ring
    .map((coord, i) => {
      const [x, y] = proj.project(coord[0], coord[1]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join("") + "Z";
}

function geometryToPath(geom: Geometry, proj: MercatorProjection): string {
  if (geom.type === "Polygon") {
    return geom.coordinates.map((ring) => ringToPath(ring, proj)).join("");
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates
      .flatMap((polygon) => polygon.map((ring) => ringToPath(ring, proj)))
      .join("");
  }
  return "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConstituencyMap() {
  const router = useRouter();
  const { data: summaryData } = useConstituenciesSummary();
  const [topology, setTopology] = useState<Topology | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

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

  const proj = useMemo(() => {
    if (!geojson) return null;
    return fitMercator(geojson, MAP_WIDTH, MAP_HEIGHT);
  }, [geojson]);

  const paths = useMemo(() => {
    if (!geojson || !proj) return [];
    return geojson.features.map((feat) => ({
      feat,
      d: geometryToPath(feat.geometry, proj),
    }));
  }, [geojson, proj]);

  const activeParties = useMemo(() => {
    if (!summaryData) return [];
    const parties = new Set<string>();
    for (const c of summaryData.constituencies) {
      if (c.winning_party_code) parties.add(c.winning_party_code);
    }
    return Array.from(parties).sort();
  }, [summaryData]);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, feat: Feature<Geometry>) => {
      const name = feat.properties?.PCON24NM ?? "Unknown";
      const match = matchConstituency(name, lookup);
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        name: match?.name ?? name,
        partyCode: match?.winning_party_code ?? null,
      });
    },
    [lookup],
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
      const name = feat.properties?.PCON24NM ?? "";
      const match = matchConstituency(name, lookup);
      if (match) {
        router.push(`/constituencies/${match.id}`);
      }
    },
    [lookup, router],
  );

  if (!topology || !geojson || !proj || paths.length === 0) {
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
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="mt-3 w-full"
          style={{ maxHeight: "70vh" }}
        >
          {paths.map(({ feat, d }, i) => {
            const name = feat.properties?.PCON24NM ?? "";
            const match = matchConstituency(name, lookup);
            const color = getConstituencyColor(match?.winning_party_code);
            return (
              <path
                key={feat.properties?.PCON24CD ?? i}
                d={d}
                fill={color}
                stroke="#1a1a1e"
                strokeWidth={0.3}
                className="cursor-pointer transition-opacity hover:opacity-80"
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
          />
        )}
      </CardContent>
    </Card>
  );
}
