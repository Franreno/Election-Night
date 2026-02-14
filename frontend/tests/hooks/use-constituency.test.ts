import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockFetchConstituency = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchConstituency: (id: number) => mockFetchConstituency(id),
}));

import { useConstituency } from "@/hooks/use-constituency";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useConstituency", () => {
  it("fetches a single constituency by id", async () => {
    const mockData = {
      id: 5,
      name: "Bedford",
      total_votes: 20000,
      winning_party_code: "C",
      parties: [],
    };
    mockFetchConstituency.mockResolvedValue(mockData);

    const { result } = renderHook(() => useConstituency(5));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(mockFetchConstituency).toHaveBeenCalledWith(5);
  });

  it("returns loading state initially", () => {
    mockFetchConstituency.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useConstituency(1));
    expect(result.current.isLoading).toBe(true);
  });

  it("handles errors", async () => {
    mockFetchConstituency.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() => useConstituency(999));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
