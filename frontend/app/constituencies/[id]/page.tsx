"use client";

import { use } from "react";
import Link from "next/link";
import { useConstituency } from "@/hooks/use-constituency";
import { WinnerBanner } from "@/components/constituency-detail/winner-banner";
import { VoteBarChart } from "@/components/constituency-detail/vote-bar-chart";
import { PartyResultsTable } from "@/components/constituency-detail/party-results-table";
import { EmptyState } from "@/components/shared/empty-state";
import {
  StatCardSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ConstituencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const constituencyId = Number(id);
  const { data, isLoading, error } = useConstituency(constituencyId);

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <Link href="/constituencies">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <div className="mt-4 space-y-4">
          <StatCardSkeleton />
          <ChartSkeleton />
          <TableSkeleton rows={5} columns={3} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <Link href="/constituencies">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <EmptyState
          title="Constituency not found"
          description="The constituency you are looking for does not exist."
          action={
            <Link href="/constituencies">
              <Button>View all constituencies</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link href="/constituencies">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h2 className="text-2xl font-semibold">{data.name}</h2>
      </div>

      <div className="mt-6 space-y-6">
        <WinnerBanner
          winningPartyCode={data.winning_party_code}
          winningPartyName={data.winning_party_name}
          parties={data.parties}
        />
        <VoteBarChart parties={data.parties} />
        <PartyResultsTable
          parties={data.parties}
          winningPartyCode={data.winning_party_code}
        />
      </div>
    </div>
  );
}
