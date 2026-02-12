import useSWR from "swr";
import { fetchTotals } from "@/lib/api";
import { POLLING_INTERVAL_MS } from "@/lib/constants";

export function useTotals() {
  return useSWR("totals", fetchTotals, {
    refreshInterval: POLLING_INTERVAL_MS,
    revalidateOnFocus: true,
  });
}
