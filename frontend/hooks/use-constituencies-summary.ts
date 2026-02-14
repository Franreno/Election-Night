import useSWR from "swr";
import { fetchConstituenciesSummary } from "@/lib/api";
import { POLLING_INTERVAL_MS } from "@/lib/constants";

export function useConstituenciesSummary() {
  return useSWR("constituencies-summary", fetchConstituenciesSummary, {
    refreshInterval: POLLING_INTERVAL_MS,
    revalidateOnFocus: true,
  });
}
