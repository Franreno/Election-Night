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
      useConstituencies("bedford", null, 1, 50, "name", "asc"),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(mockFetchConstituencies).toHaveBeenCalledWith({
      search: "bedford",
      region_ids: undefined,
      page: 1,
      page_size: 50,
      sort_by: "name",
      sort_dir: "asc",
    });
  });

  it("uses default page size of 50", async () => {
    mockFetchConstituencies.mockResolvedValue({ constituencies: [] });

    renderHook(() => useConstituencies("test-default", null, 1));

    await waitFor(() => {
      expect(mockFetchConstituencies).toHaveBeenCalledWith(
        expect.objectContaining({ page_size: 50 }),
      );
    });
  });

  it("passes sort parameters when provided", async () => {
    mockFetchConstituencies.mockResolvedValue({ constituencies: [] });

    renderHook(() => useConstituencies("test-sort", null, 1, 20, "total_votes", "desc"));

    await waitFor(() => {
      expect(mockFetchConstituencies).toHaveBeenCalledWith({
        search: "test-sort",
        region_ids: undefined,
        page: 1,
        page_size: 20,
        sort_by: "total_votes",
        sort_dir: "desc",
      });
    });
  });

  it("passes region_ids as comma-separated string", async () => {
    mockFetchConstituencies.mockResolvedValue({ constituencies: [] });

    renderHook(() => useConstituencies("", [1, 3, 5], 1, 20));

    await waitFor(() => {
      expect(mockFetchConstituencies).toHaveBeenCalledWith(
        expect.objectContaining({ region_ids: "1,3,5" }),
      );
    });
  });

  it("passes region_ids as undefined when null", async () => {
    mockFetchConstituencies.mockResolvedValue({ constituencies: [] });

    renderHook(() => useConstituencies("", null, 1, 20));

    await waitFor(() => {
      expect(mockFetchConstituencies).toHaveBeenCalledWith(
        expect.objectContaining({ region_ids: undefined }),
      );
    });
  });
});
