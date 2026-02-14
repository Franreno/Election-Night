"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useConstituencies } from "@/hooks/use-constituencies";
import { useRegions } from "@/hooks/use-region";
import { ConstituencySearch } from "@/components/constituencies/constituency-search";
import { ConstituenciesTable } from "@/components/constituencies/constituencies-table";
import type {
  SortField,
  SortDir,
} from "@/components/constituencies/constituencies-table";
import { PaginationControls } from "@/components/constituencies/pagination-controls";
import { RegionFilter } from "@/components/constituencies/region-filter";
import { ConstituencyMap } from "@/components/map/constituency-map";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

export function ConstituenciesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: regionsData } = useRegions();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedRegionIds, setSelectedRegionIds] = useState<Set<number>>(
    new Set()
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize selected regions from URL or default to all
  useEffect(() => {
    if (!regionsData) return;

    const regionsParam = searchParams.get("regions");
    if (regionsParam) {
      const ids = regionsParam
        .split(",")
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id));
      if (ids.length > 0) {
        setSelectedRegionIds(new Set(ids));
        setIsInitialized(true);
        return;
      }
    }

    // Default: all regions selected
    setSelectedRegionIds(new Set(regionsData.regions.map((r) => r.id)));
    setIsInitialized(true);
  }, [regionsData, searchParams]);

  // Update URL when selected regions change (only after initialization)
  useEffect(() => {
    if (!isInitialized || !regionsData) return;

    if (
      selectedRegionIds.size === 0 ||
      selectedRegionIds.size === regionsData.regions.length
    ) {
      // All selected = no param
      const params = new URLSearchParams(searchParams.toString());
      params.delete("regions");
      router.replace(`/constituencies?${params.toString()}`, { scroll: false });
    } else {
      const ids = Array.from(selectedRegionIds).sort((a, b) => a - b);
      const params = new URLSearchParams(searchParams.toString());
      params.set("regions", ids.join(","));
      router.replace(`/constituencies?${params.toString()}`, { scroll: false });
    }
  }, [selectedRegionIds, regionsData, router, searchParams, isInitialized]);

  // Prepare region IDs for API call
  const regionIdsForApi = useMemo(() => {
    if (
      !regionsData ||
      selectedRegionIds.size === 0 ||
      selectedRegionIds.size === regionsData.regions.length
    ) {
      return null; // All regions selected = no filter
    }
    return Array.from(selectedRegionIds);
  }, [selectedRegionIds, regionsData]);

  // Fetch constituencies with backend filtering
  const { data, isLoading } = useConstituencies(
    search,
    regionIdsForApi,
    page,
    DEFAULT_PAGE_SIZE,
    sortField ?? undefined,
    sortField ? sortDir : undefined
  );

  const handleSearch = useCallback((value: string) => {
    setIsTransitioning(true);
    setSearch(value);
    setPage(1);
    setTimeout(() => setIsTransitioning(false), 50);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      setIsTransitioning(true);
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir(field === "total_votes" ? "desc" : "asc");
      }
      setPage(1);
      setTimeout(() => setIsTransitioning(false), 50);
    },
    [sortField]
  );

  const handleRegionsChange = useCallback((newSelected: Set<number>) => {
    setIsTransitioning(true);
    setSelectedRegionIds(newSelected);
    setPage(1);
    setTimeout(() => setIsTransitioning(false), 50);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setIsTransitioning(true);
    setPage(newPage);
    setTimeout(() => setIsTransitioning(false), 50);
  }, []);

  const selectedRegionIdsArray = Array.from(selectedRegionIds);
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  if (isLoading && !data) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Constituencies</h2>
        <div className="mt-6">
          <TableSkeleton rows={8} columns={3} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">Constituencies</h2>

      {/* Filters - responsive layout */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <ConstituencySearch value={search} onChange={handleSearch} />
        </div>
        {regionsData && (
          <div className="sm:w-auto">
            <RegionFilter
              regions={regionsData.regions}
              selectedRegionIds={selectedRegionIds}
              onSelectedChange={handleRegionsChange}
            />
          </div>
        )}
      </div>

      {/* Results count */}
      {data && data.constituencies.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Showing {data.total} constituencies
          {selectedRegionIds.size < (regionsData?.regions.length ?? 0) &&
            ` in ${selectedRegionIds.size} ${selectedRegionIds.size === 1 ? "region" : "regions"}`}
        </p>
      )}

      {/* Grid Layout: Table (60%) + Map (40%) - Desktop: side-by-side, Mobile: vertical with table first */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Table - Left side on desktop (60%), First on mobile */}
        <div className="lg:col-span-6 order-1">
          <div
            className={`transition-opacity duration-200 ${isTransitioning ? "opacity-40" : "opacity-100"}`}
          >
            {!data || data.constituencies.length === 0 ? (
              search ||
              selectedRegionIds.size < (regionsData?.regions.length ?? 0) ? (
                <EmptyState
                  title="No results found"
                  description={
                    search
                      ? `No constituencies matching "${search}"${selectedRegionIds.size < (regionsData?.regions.length ?? 0) ? " in selected regions" : ""}.`
                      : "No constituencies in selected regions."
                  }
                />
              ) : (
                <EmptyState
                  title="No constituency data"
                  description="Upload a results file to see constituency data."
                />
              )
            ) : (
              <>
                <ConstituenciesTable
                  constituencies={data.constituencies}
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                {totalPages > 1 && (
                  <div className="mt-4">
                    <PaginationControls
                      page={page}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Map - Right side on desktop (40%), Second on mobile */}
        <div className="lg:col-span-4 order-2">
          <ConstituencyMap selectedRegionIds={selectedRegionIdsArray} />
        </div>
      </div>
    </div>
  );
}
