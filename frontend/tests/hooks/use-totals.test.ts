import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockFetchTotals = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchTotals: () => mockFetchTotals(),
}));

vi.mock("@/lib/constants", () => ({
  POLLING_INTERVAL_MS: 0,
}));

import { useTotals } from "@/hooks/use-totals";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTotals", () => {
  it("fetches and returns totals data", async () => {
    const mockData = {
      total_constituencies: 650,
      total_votes: 30000000,
      parties: [{ party_code: "C", total_votes: 10000000, seats: 300 }],
    };
    mockFetchTotals.mockResolvedValue(mockData);

    const { result } = renderHook(() => useTotals());

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
  });

  it("returns isValidating property from SWR", async () => {
    mockFetchTotals.mockResolvedValue({ total_votes: 0 });

    const { result } = renderHook(() => useTotals());

    // SWR hooks always expose isValidating
    expect(typeof result.current.isValidating).toBe("boolean");
  });
});
