"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useConstituencies } from "@/hooks/use-constituencies";
import { ConstituencySearch } from "@/components/constituencies/constituency-search";
import { ConstituenciesTable } from "@/components/constituencies/constituencies-table";
import type { SortField, SortDir } from "@/components/constituencies/constituencies-table";
import { PaginationControls } from "@/components/constituencies/pagination-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

export default function ConstituenciesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data, isLoading } = useConstituencies(
    search,
    page,
    DEFAULT_PAGE_SIZE,
    sortField ?? undefined,
    sortField ? sortDir : undefined,
  );

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir(field === "total_votes" ? "desc" : "asc");
      }
      setPage(1);
    },
    [sortField],
  );

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div>
      <h2 className="text-2xl font-semibold">Constituencies</h2>

      <div className="mt-6 max-w-sm">
        <ConstituencySearch value={search} onChange={handleSearch} />
      </div>

      <div className="mt-4">
        {isLoading && !data ? (
          <TableSkeleton rows={8} columns={3} />
        ) : !data || data.constituencies.length === 0 ? (
          search ? (
            <EmptyState
              title="No results found"
              description={`No constituencies matching "${search}".`}
            />
          ) : (
            <EmptyState
              title="No constituency data"
              description="Upload a results file to see constituency data."
              action={
                <Link href="/upload">
                  <Button>Go to Upload</Button>
                </Link>
              }
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
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
