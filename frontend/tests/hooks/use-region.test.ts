import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockFetchRegions = vi.fn();
const mockFetchRegionDetail = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchRegions: () => mockFetchRegions(),
  fetchRegionDetail: (id: number) => mockFetchRegionDetail(id),
}));

import { useRegions, useRegionDetail } from "@/hooks/use-region";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useRegions", () => {
  it("fetches regions list", async () => {
    const mockData = {
      regions: [
        { id: 1, name: "London", sort_order: 1, constituency_count: 73 },
      ],
    };
    mockFetchRegions.mockResolvedValue(mockData);

    const { result } = renderHook(() => useRegions());

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
  });
});

describe("useRegionDetail", () => {
  it("fetches region detail when id is provided", async () => {
    const mockData = {
      id: 1,
      name: "London",
      pcon24_codes: ["E1"],
      constituencies: [{ id: 1, name: "Westminster" }],
    };
    mockFetchRegionDetail.mockResolvedValue(mockData);

    const { result } = renderHook(() => useRegionDetail(1));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
    expect(mockFetchRegionDetail).toHaveBeenCalledWith(1);
  });

  it("does not fetch when id is null", () => {
    const { result } = renderHook(() => useRegionDetail(null));
    expect(result.current.data).toBeUndefined();
    expect(mockFetchRegionDetail).not.toHaveBeenCalled();
  });
});
