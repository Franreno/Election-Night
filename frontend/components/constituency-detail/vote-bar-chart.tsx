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
import type { PartyResult } from "@/lib/types";

interface VoteBarChartProps {
  parties: PartyResult[];
}

export function VoteBarChart({ parties }: VoteBarChartProps) {
  const chartConfig = parties.reduce<ChartConfig>((acc, p) => {
    acc[p.party_code] = {
      label: PARTY_NAMES[p.party_code] || p.party_code,
      color: PARTY_COLORS[p.party_code] || "#888888",
    };
    return acc;
  }, {} satisfies ChartConfig);

  const data = parties.map((p) => ({
    party: PARTY_NAMES[p.party_code] || p.party_code,
    votes: p.votes,
    fill: PARTY_COLORS[p.party_code] || "#888888",
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Vote Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <BarChart data={data} layout="vertical" accessibilityLayer>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <YAxis
              dataKey="party"
              type="category"
              tickLine={false}
              axisLine={false}
              width={120}
              tick={{ fontSize: 11 }}
            />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="votes" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
