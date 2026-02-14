import useSWRImmutable from "swr/immutable";
import { fetchRegions, fetchRegionDetail } from "@/lib/api";

export function useRegions() {
  return useSWRImmutable("regions", fetchRegions);
}

export function useRegionDetail(regionId: number | null) {
  return useSWRImmutable(
    regionId !== null ? `region-${regionId}` : null,
    () => (regionId !== null ? fetchRegionDetail(regionId) : null),
  );
}
