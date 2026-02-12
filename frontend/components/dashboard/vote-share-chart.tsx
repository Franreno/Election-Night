"use client";

import { Pie, PieChart, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PARTY_COLORS, PARTY_NAMES } from "@/lib/constants";
import type { PartyTotals } from "@/lib/types";

interface VoteShareChartProps {
  parties: PartyTotals[];
}

export function VoteShareChart({ parties }: VoteShareChartProps) {
  const chartConfig = parties.reduce<ChartConfig>((acc, p) => {
    acc[p.party_code] = {
      label: PARTY_NAMES[p.party_code] || p.party_code,
      color: PARTY_COLORS[p.party_code] || "#888888",
    };
    return acc;
  }, {} satisfies ChartConfig);

  const data = parties.map((p) => ({
    name: p.party_code,
    partyName: PARTY_NAMES[p.party_code] || p.party_code,
    value: p.total_votes,
    fill: PARTY_COLORS[p.party_code] || "#888888",
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          National Vote Share
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <PieChart accessibilityLayer>
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
                        {Number(value).toLocaleString("en-GB")} votes
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={2}
              stroke="var(--background)"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
