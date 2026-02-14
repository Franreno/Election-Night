"use client";

import Link from "next/link";
import { useTotals } from "@/hooks/use-totals";
import { StatCard } from "@/components/dashboard/stat-card";
import { SeatDistributionChart } from "@/components/dashboard/seat-distribution-chart";
import { VoteShareChart } from "@/components/dashboard/vote-share-chart";
import { Hemicycle } from "@/components/dashboard/hemicycle";
import { ConstituencyMap } from "@/components/map/constituency-map";
import { EmptyState } from "@/components/shared/empty-state";
import {
  StatCardSkeleton,
  ChartSkeleton,
} from "@/components/shared/loading-skeleton";
import { PartyBadge } from "@/components/shared/party-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const numberFormatter = new Intl.NumberFormat("en-GB");
const MAJORITY_THRESHOLD = 326;

export default function DashboardPage() {
  const { data, isLoading } = useTotals();

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">UK Election Results</h1>
          <p className="text-sm text-muted-foreground mt-1">Loading...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-10">
          <div className="lg:col-span-5">
            <ChartSkeleton />
          </div>
          <div className="lg:col-span-5">
            <ChartSkeleton />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (!data || data.total_constituencies === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">UK Election Results</h1>
          <p className="text-sm text-muted-foreground mt-1">
            0 / 650 constituencies declared
          </p>
        </div>
        <EmptyState
          title="No election data yet"
          description="Upload a results file to get started."
          action={
            <Link href="/upload">
              <Button>Go to Upload</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const leadingParty = data.parties[0];
  const seatsToMajority = leadingParty
    ? Math.max(0, MAJORITY_THRESHOLD - leadingParty.seats)
    : MAJORITY_THRESHOLD;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">UK Election Results</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {numberFormatter.format(data.total_constituencies)} / 650
          constituencies declared
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Constituencies Declared"
          value={numberFormatter.format(data.total_constituencies)}
        />
        <StatCard
          title="Total Votes Cast"
          value={numberFormatter.format(data.total_votes)}
        />
        <StatCard
          title="Leading Party"
          value={leadingParty ? `${leadingParty.seats} seats` : "—"}
          subtitle={
            leadingParty ? (
              <PartyBadge partyCode={leadingParty.party_code} />
            ) : undefined
          }
        />
      </div>

      {/* Hero Grid: Map (70%) + Hemicycle (30%) */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-10">
        {/* Left: Choropleth Map */}
        <div className="lg:col-span-5">
          <ConstituencyMap />
        </div>

        {/* Right: Hemicycle + Government Status */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <Hemicycle parties={data.parties} />

          {/* Government Status Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Government Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Majority threshold:
                </span>
                <span className="font-medium">{MAJORITY_THRESHOLD} seats</span>
              </div>
              {leadingParty && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Leading party:
                    </span>
                    <span className="font-medium">
                      {leadingParty.seats} seats
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {leadingParty.seats >= MAJORITY_THRESHOLD
                        ? "Majority by:"
                        : "Seats to majority:"}
                    </span>
                    <span className="font-medium">
                      {leadingParty.seats >= MAJORITY_THRESHOLD
                        ? `${leadingParty.seats - MAJORITY_THRESHOLD} seats`
                        : `${seatsToMajority} seats`}
                    </span>
                  </div>
                  {leadingParty.seats >= MAJORITY_THRESHOLD && (
                    <div className="pt-1.5 mt-1.5 border-t">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                        <span>✓</span>
                        <span>Majority government possible</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Secondary Insights: Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SeatDistributionChart parties={data.parties} />
        <VoteShareChart parties={data.parties} />
      </div>
    </div>
  );
}
