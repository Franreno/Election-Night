import useSWR from "swr";
import { fetchConstituency } from "@/lib/api";

export function useConstituency(id: number) {
  return useSWR(`constituency-${id}`, () => fetchConstituency(id));
}
