import { PARTY_COLORS, PARTY_NAMES } from "@/lib/constants";

interface MapLegendProps {
  /** Party codes that won at least one seat */
  activeParties: string[];
}

export function MapLegend({ activeParties }: MapLegendProps) {
  if (activeParties.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {activeParties.map((code) => (
        <div key={code} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: PARTY_COLORS[code] ?? "#888" }}
          />
          <span className="text-xs text-muted-foreground">
            {PARTY_NAMES[code] ?? code}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ backgroundColor: "#2a2a2e" }}
        />
        <span className="text-xs text-muted-foreground">No data</span>
      </div>
    </div>
  );
}
