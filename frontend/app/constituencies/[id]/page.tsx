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
} from "@/components/shared/loading-skeleton";
import { ConstituencyMiniMap } from "@/components/constituency-detail/constituency-mini-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Hash } from "lucide-react";

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
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-10">
          <div className="lg:col-span-7">
            <StatCardSkeleton />
          </div>
          <div className="lg:col-span-3">
            <ChartSkeleton />
          </div>
        </div>
        <div className="mt-6">
          <ChartSkeleton />
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
      {/* Header with inline metadata chips */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Link href="/constituencies">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">{data.name}</h1>
        {data.region_name && (
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Region:</span>
            <span className="font-medium">{data.region_name}</span>
          </div>
        )}
        {data.pcon24_code && (
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-sm font-mono">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{data.pcon24_code}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Content (70%) + Mini Map (30%) */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-10">
        {/* Left: Winner Banner + Results (70%) */}
        <div className="lg:col-span-7 space-y-6">
          <WinnerBanner
            winningPartyCode={data.winning_party_code}
            winningPartyName={data.winning_party_name}
            parties={data.parties}
          />

          {/* Results Section with Tabs */}
          <Tabs defaultValue="chart" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chart">Chart</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
            <TabsContent value="chart">
              <VoteBarChart parties={data.parties} />
            </TabsContent>
            <TabsContent value="table">
              <PartyResultsTable
                parties={data.parties}
                winningPartyCode={data.winning_party_code}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Mini Map (30%) */}
        <div className="lg:col-span-3 flex items-start justify-center">
          {data.pcon24_code ? (
            <ConstituencyMiniMap
              pcon24Code={data.pcon24_code}
              constituencyName={data.name}
              winningPartyCode={data.winning_party_code}
            />
          ) : (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-base">Map Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Map not available
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
