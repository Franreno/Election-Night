import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockFetchConstituencies = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchConstituencies: (...args: unknown[]) => mockFetchConstituencies(...args),
}));

vi.mock("@/lib/constants", () => ({
  POLLING_INTERVAL_MS: 0,
}));

import { useConstituencies } from "@/hooks/use-constituencies";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useConstituencies", () => {
  it("fetches constituencies with parameters", async () => {
    const mockData = {
      total: 1,
      page: 1,
      page_size: 50,
      constituencies: [{ id: 1, name: "Bedford" }],
    };
    mockFetchConstituencies.mockResolvedValue(mockData);

    const { result } = renderHook(() =>
      useConstituencies("bedford", 1, 50, "name", "asc"),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(mockFetchConstituencies).toHaveBeenCalledWith({
      search: "bedford",
      page: 1,
      page_size: 50,
      sort_by: "name",
      sort_dir: "asc",
    });
  });

  it("uses default page size of 50", async () => {
    mockFetchConstituencies.mockResolvedValue({ constituencies: [] });

    renderHook(() => useConstituencies("test-default", 1));

    await waitFor(() => {
      expect(mockFetchConstituencies).toHaveBeenCalledWith(
        expect.objectContaining({ page_size: 50 }),
      );
    });
  });

  it("passes sort parameters when provided", async () => {
    mockFetchConstituencies.mockResolvedValue({ constituencies: [] });

    renderHook(() => useConstituencies("test-sort", 1, 20, "total_votes", "desc"));

    await waitFor(() => {
      expect(mockFetchConstituencies).toHaveBeenCalledWith({
        search: "test-sort",
        page: 1,
        page_size: 20,
        sort_by: "total_votes",
        sort_dir: "desc",
      });
    });
  });
});
