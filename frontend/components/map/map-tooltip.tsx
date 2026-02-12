import { PartyBadge } from "@/components/shared/party-badge";

interface MapTooltipProps {
  x: number;
  y: number;
  name: string;
  partyCode: string | null;
}

export function MapTooltip({ x, y, name, partyCode }: MapTooltipProps) {
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border border-border bg-popover px-3 py-2 shadow-md"
      style={{ left: x + 12, top: y - 28 }}
    >
      <p className="text-sm font-medium text-popover-foreground">{name}</p>
      {partyCode ? (
        <div className="mt-1">
          <PartyBadge partyCode={partyCode} />
        </div>
      ) : (
        <p className="mt-0.5 text-xs text-muted-foreground">No data</p>
      )}
    </div>
  );
}
