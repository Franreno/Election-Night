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
        <CardContent className="py-6">
          <p className="text-xl font-semibold">No clear winner</p>
          <p className="text-sm text-muted-foreground">Tied result</p>
        </CardContent>
      </Card>
    );
  }

  const color = PARTY_COLORS[winningPartyCode] || "#888888";
  const name = winningPartyName || PARTY_NAMES[winningPartyCode] || winningPartyCode;
  const winner = parties[0];
  const runnerUp = parties[1];
  const majority = winner && runnerUp ? winner.votes - runnerUp.votes : null;

  return (
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <CardContent className="py-6">
        <p className="text-xl font-bold mb-2" style={{ color }}>
          {name}
        </p>
        {winner && (
          <div className="space-y-1">
            <p className="text-base font-medium">
              {numberFormatter.format(winner.votes)} votes ({winner.percentage}%)
            </p>
            {majority !== null && (
              <p className="text-sm text-muted-foreground">
                Majority: {numberFormatter.format(majority)} votes
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
