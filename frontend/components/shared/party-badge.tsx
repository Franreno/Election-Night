import { Badge } from "@/components/ui/badge";
import { PARTY_COLORS, PARTY_NAMES } from "@/lib/constants";

interface PartyBadgeProps {
  partyCode: string;
  className?: string;
}

/** Return relative luminance from a hex colour string. */
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function PartyBadge({ partyCode, className }: PartyBadgeProps) {
  const color = PARTY_COLORS[partyCode] || "#888888";
  const name = PARTY_NAMES[partyCode] || partyCode;
  const textColor = luminance(color) > 0.4 ? "#000" : "#fff";

  return (
    <Badge
      className={className}
      style={{ backgroundColor: color, color: textColor, borderColor: color }}
    >
      {name}
    </Badge>
  );
}
