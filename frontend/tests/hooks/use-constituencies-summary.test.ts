import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockFetchConstituenciesSummary = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchConstituenciesSummary: () => mockFetchConstituenciesSummary(),
}));

vi.mock("@/lib/constants", () => ({
  POLLING_INTERVAL_MS: 0,
}));

import { useConstituenciesSummary } from "@/hooks/use-constituencies-summary";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useConstituenciesSummary", () => {
  it("fetches constituencies summary", async () => {
    const mockData = {
      total: 650,
      constituencies: [
        { id: 1, name: "Bedford", winning_party_code: "C", pcon24_code: "E14000539", region_name: "East" },
      ],
    };
    mockFetchConstituenciesSummary.mockResolvedValue(mockData);

    const { result } = renderHook(() => useConstituenciesSummary());

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
  });

  it("returns data with correct shape", async () => {
    const mockData = { total: 100, constituencies: [] };
    mockFetchConstituenciesSummary.mockResolvedValue(mockData);

    const { result } = renderHook(() => useConstituenciesSummary());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });
});
