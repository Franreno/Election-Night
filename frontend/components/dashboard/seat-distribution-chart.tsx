"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PARTY_COLORS, PARTY_NAMES } from "@/lib/constants";
import type { PartyTotals } from "@/lib/types";

interface SeatDistributionChartProps {
  parties: PartyTotals[];
}

export function SeatDistributionChart({ parties }: SeatDistributionChartProps) {
  const chartConfig = parties.reduce<ChartConfig>((acc, p) => {
    acc[p.party_code] = {
      label: PARTY_NAMES[p.party_code] || p.party_code,
      color: PARTY_COLORS[p.party_code] || "#888888",
    };
    return acc;
  }, {} satisfies ChartConfig);

  const data = parties.map((p) => ({
    party: p.party_code,
    partyName: PARTY_NAMES[p.party_code] || p.party_code,
    seats: p.seats,
    fill: PARTY_COLORS[p.party_code] || "#888888",
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Seat Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="party"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: item.payload.fill }}
                      />
                      <span className="text-muted-foreground">
                        {item.payload.partyName}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {value} seats
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="seats" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
