import { Card, CardContent } from "@/components/ui/card";
import { PARTY_COLORS, PARTY_NAMES } from "@/lib/constants";

interface WinnerBannerProps {
  winningPartyCode: string | null;
  winningPartyName: string | null;
  parties: Array<{ votes: number; percentage: number }>;
}

const numberFormatter = new Intl.NumberFormat("en-GB");

export function WinnerBanner({
  winningPartyCode,
  winningPartyName,
  parties,
}: WinnerBannerProps) {
  if (!winningPartyCode) {
    return (
      <Card className="border-l-4 border-l-muted-foreground">
        <CardContent className="py-4">
          <p className="text-lg font-semibold">No clear winner</p>
          <p className="text-sm text-muted-foreground">Tied result</p>
        </CardContent>
      </Card>
    );
  }

  const color = PARTY_COLORS[winningPartyCode] || "#888888";
  const name = winningPartyName || PARTY_NAMES[winningPartyCode] || winningPartyCode;
  const winner = parties[0];

  return (
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <CardContent className="py-4">
        <p className="text-lg font-semibold" style={{ color }}>
          {name}
        </p>
        {winner && (
          <p className="text-sm text-muted-foreground">
            {numberFormatter.format(winner.votes)} votes ({winner.percentage}%)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
