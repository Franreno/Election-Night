"use client";

import Link from "next/link";
import { useTotals } from "@/hooks/use-totals";
import { StatCard } from "@/components/dashboard/stat-card";
import { SeatDistributionChart } from "@/components/dashboard/seat-distribution-chart";
import { VoteShareChart } from "@/components/dashboard/vote-share-chart";
import { ConstituencyMap } from "@/components/map/constituency-map";
import { EmptyState } from "@/components/shared/empty-state";
import {
  StatCardSkeleton,
  ChartSkeleton,
} from "@/components/shared/loading-skeleton";
import { PartyBadge } from "@/components/shared/party-badge";
import { Button } from "@/components/ui/button";

const numberFormatter = new Intl.NumberFormat("en-GB");

export default function DashboardPage() {
  const { data, isLoading } = useTotals();

  if (isLoading) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
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
        <h2 className="text-2xl font-semibold">Dashboard</h2>
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

  return (
    <div>
      <h2 className="text-2xl font-semibold">Dashboard</h2>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SeatDistributionChart parties={data.parties} />
        <VoteShareChart parties={data.parties} />
      </div>

      <div className="mt-6">
        <ConstituencyMap />
      </div>
    </div>
  );
}
