import useSWR from "swr";
import { fetchConstituencies } from "@/lib/api";
import { POLLING_INTERVAL_MS } from "@/lib/constants";

export function useConstituencies(
  search: string,
  regionIds: number[] | null,
  page: number,
  pageSize: number = 50,
  sortBy?: string,
  sortDir?: string,
) {
  const regionIdsStr = regionIds?.join(",") ?? "";
  const key = `constituencies-${search}-${regionIdsStr}-${page}-${pageSize}-${sortBy}-${sortDir}`;

  return useSWR(
    key,
    () =>
      fetchConstituencies({
        search,
        region_ids: regionIdsStr || undefined,
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
    {
      refreshInterval: POLLING_INTERVAL_MS,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );
}
