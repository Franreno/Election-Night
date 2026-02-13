"use client";

import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { useConstituenciesSummary } from "@/hooks/use-constituencies-summary";
import { getConstituencyColor } from "@/lib/map-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOPOJSON_URL = `${API_BASE}/static/uk-constituencies.topojson`;

const MINI_MAP_SIZE = 300;

interface ConstituencyMiniMapProps {
  pcon24Code: string;
  constituencyName: string;
  winningPartyCode: string | null;
}

export function ConstituencyMiniMap({
  pcon24Code,
  constituencyName,
  winningPartyCode,
}: ConstituencyMiniMapProps) {
  const { data: summaryData } = useConstituenciesSummary();
  const [topology, setTopology] = useState<Topology | null>(null);

  useEffect(() => {
    fetch(TOPOJSON_URL)
      .then((res) => res.json())
      .then(setTopology)
      .catch(() => {});
  }, []);

  // Find the region this constituency belongs to and get all pcon24 codes in that region
  const regionCodes = useMemo(() => {
    if (!summaryData) return new Set<string>();
    const current = summaryData.constituencies.find(
      (c) => c.pcon24_code === pcon24Code,
    );
    if (!current?.region_name) return new Set([pcon24Code]);
    const codes = new Set<string>();
    for (const c of summaryData.constituencies) {
      if (c.region_name === current.region_name && c.pcon24_code) {
        codes.add(c.pcon24_code);
      }
    }
    return codes;
  }, [summaryData, pcon24Code]);

  // Build a lookup of pcon24_code → winning_party_code for the region
  const partyLookup = useMemo(() => {
    if (!summaryData) return new Map<string, string | null>();
    const map = new Map<string, string | null>();
    for (const c of summaryData.constituencies) {
      if (c.pcon24_code && regionCodes.has(c.pcon24_code)) {
        map.set(c.pcon24_code, c.winning_party_code);
      }
    }
    return map;
  }, [summaryData, regionCodes]);

  // Filter TopoJSON features to only the region's constituencies
  const regionGeoJson = useMemo<FeatureCollection | null>(() => {
    if (!topology || regionCodes.size === 0) return null;
    const layerName = Object.keys(topology.objects)[0];
    const full = feature(
      topology,
      topology.objects[layerName],
    ) as FeatureCollection;
    const filtered = full.features.filter((f) =>
      regionCodes.has(f.properties?.PCON24CD ?? ""),
    );
    if (filtered.length === 0) return null;
    return { type: "FeatureCollection", features: filtered };
  }, [topology, regionCodes]);

  const pathGenerator = useMemo(() => {
    if (!regionGeoJson) return null;
    const projection = geoMercator().fitSize(
      [MINI_MAP_SIZE, MINI_MAP_SIZE],
      regionGeoJson,
    );
    return geoPath(projection);
  }, [regionGeoJson]);

  const paths = useMemo(() => {
    if (!regionGeoJson || !pathGenerator) return [];
    return regionGeoJson.features.map((feat) => ({
      feat,
      d: pathGenerator(feat.geometry) ?? "",
    }));
  }, [regionGeoJson, pathGenerator]);

  if (!topology || !regionGeoJson || paths.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Region Map</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-[300px]" />
        </CardContent>
      </Card>
    );
  }

  const regionName =
    summaryData?.constituencies.find((c) => c.pcon24_code === pcon24Code)
      ?.region_name ?? "Region";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{regionName}</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <svg
          viewBox={`0 0 ${MINI_MAP_SIZE} ${MINI_MAP_SIZE}`}
          width={MINI_MAP_SIZE}
          height={MINI_MAP_SIZE}
          className="max-w-full"
        >
          {paths.map(({ feat, d }, i) => {
            const code = feat.properties?.PCON24CD ?? "";
            const isCurrent = code === pcon24Code;
            const partyCode = partyLookup.get(code) ?? null;
            const color = getConstituencyColor(partyCode);
            return (
              <path
                key={code || i}
                d={d}
                fill={color}
                fillOpacity={isCurrent ? 1 : 0.3}
                stroke={isCurrent ? "#ffffff" : "#1a1a1e"}
                strokeWidth={isCurrent ? 2 : 0.5}
              />
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}
