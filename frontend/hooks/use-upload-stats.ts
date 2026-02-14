import useSWR from "swr";
import { fetchUploadStats } from "@/lib/api";
import { UPLOAD_POLLING_INTERVAL_MS } from "@/lib/constants";

export function useUploadStats() {
  return useSWR("upload-stats", fetchUploadStats, {
    refreshInterval: UPLOAD_POLLING_INTERVAL_MS,
  });
}
