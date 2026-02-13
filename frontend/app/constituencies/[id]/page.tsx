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
import { ConstituencyMiniMap } from "@/components/constituency-detail/constituency-mini-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin } from "lucide-react";

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


  console.log(data)
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
        {data.region_name && (
          <Card>
            <CardContent className="flex items-center gap-6 py-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Region:</span>
                <span className="font-medium">{data.region_name}</span>
              </div>
              {data.pcon24_code && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Code:</span>
                  <span className="font-mono text-sm">{data.pcon24_code}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <WinnerBanner
          winningPartyCode={data.winning_party_code}
          winningPartyName={data.winning_party_name}
          parties={data.parties}
        />

        {data.pcon24_code && (
          <ConstituencyMiniMap
            pcon24Code={data.pcon24_code}
            constituencyName={data.name}
            winningPartyCode={data.winning_party_code}
          />
        )}

        <VoteBarChart parties={data.parties} />
        <PartyResultsTable
          parties={data.parties}
          winningPartyCode={data.winning_party_code}
        />
      </div>
    </div>
  );
}
