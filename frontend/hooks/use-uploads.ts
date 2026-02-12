import useSWR from "swr";
import { fetchUploads } from "@/lib/api";
import { UPLOAD_POLLING_INTERVAL_MS } from "@/lib/constants";

export function useUploads(page: number = 1, pageSize: number = 20) {
  return useSWR(
    `uploads-${page}-${pageSize}`,
    () => fetchUploads({ page, page_size: pageSize }),
    {
      refreshInterval: UPLOAD_POLLING_INTERVAL_MS,
    },
  );
}
