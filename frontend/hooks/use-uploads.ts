import useSWR from "swr";
import { fetchUploads } from "@/lib/api";
import { UPLOAD_POLLING_INTERVAL_MS } from "@/lib/constants";

export interface UploadFilters {
  status?: string;
  search?: string;
}

export function useUploads(
  page: number = 1,
  pageSize: number = 20,
  filters?: UploadFilters,
) {
  const key = `uploads-${page}-${pageSize}-${filters?.status ?? ""}-${filters?.search ?? ""}`;
  return useSWR(
    key,
    () =>
      fetchUploads({
        page,
        page_size: pageSize,
        status: filters?.status,
        search: filters?.search,
      }),
    {
      refreshInterval: UPLOAD_POLLING_INTERVAL_MS,
    },
  );
}
