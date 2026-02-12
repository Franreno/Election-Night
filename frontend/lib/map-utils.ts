import type { ConstituencySummary } from "./types";
import { PARTY_COLORS } from "./constants";

export interface ConstituencyMapEntry {
  id: number;
  name: string;
  winning_party_code: string | null;
}

const NO_DATA_COLOR = "#2a2a2e";

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Build a lookup map from normalized constituency name to summary data.
 */
export function buildConstituencyLookup(
  constituencies: ConstituencySummary[],
): Map<string, ConstituencyMapEntry> {
  const lookup = new Map<string, ConstituencyMapEntry>();
  for (const c of constituencies) {
    lookup.set(normalizeName(c.name), {
      id: c.id,
      name: c.name,
      winning_party_code: c.winning_party_code,
    });
  }
  return lookup;
}

/**
 * Find the matching constituency for a GeoJSON feature name.
 */
export function matchConstituency(
  geoName: string,
  lookup: Map<string, ConstituencyMapEntry>,
): ConstituencyMapEntry | undefined {
  return lookup.get(normalizeName(geoName));
}

/**
 * Get the fill color for a constituency based on its winning party.
 */
export function getConstituencyColor(
  partyCode: string | null | undefined,
): string {
  if (!partyCode) return NO_DATA_COLOR;
  return PARTY_COLORS[partyCode] ?? NO_DATA_COLOR;
}
