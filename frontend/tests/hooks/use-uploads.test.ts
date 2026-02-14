import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockFetchUploads = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchUploads: (params: unknown) => mockFetchUploads(params),
}));

vi.mock("@/lib/constants", () => ({
  UPLOAD_POLLING_INTERVAL_MS: 0,
}));

import { useUploads } from "@/hooks/use-uploads";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUploads", () => {
  it("fetches upload history with default params", async () => {
    const mockData = {
      total: 2,
      page: 1,
      page_size: 20,
      uploads: [{ id: 1, filename: "test.txt", status: "completed" }],
    };
    mockFetchUploads.mockResolvedValue(mockData);

    const { result } = renderHook(() => useUploads());

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(mockFetchUploads).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      status: undefined,
      search: undefined,
    });
  });

  it("passes custom page and pageSize", async () => {
    mockFetchUploads.mockResolvedValue({ uploads: [] });

    renderHook(() => useUploads(3, 50));

    await waitFor(() => {
      expect(mockFetchUploads).toHaveBeenCalledWith({
        page: 3,
        page_size: 50,
        status: undefined,
        search: undefined,
      });
    });
  });

  it("passes status filter", async () => {
    mockFetchUploads.mockResolvedValue({ uploads: [] });

    renderHook(() => useUploads(1, 20, { status: "completed" }));

    await waitFor(() => {
      expect(mockFetchUploads).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" }),
      );
    });
  });

  it("passes search filter", async () => {
    mockFetchUploads.mockResolvedValue({ uploads: [] });

    renderHook(() => useUploads(1, 20, { search: "election" }));

    await waitFor(() => {
      expect(mockFetchUploads).toHaveBeenCalledWith(
        expect.objectContaining({ search: "election" }),
      );
    });
  });

  it("passes combined filters", async () => {
    mockFetchUploads.mockResolvedValue({ uploads: [] });

    renderHook(() =>
      useUploads(2, 10, { status: "failed", search: "test" }),
    );

    await waitFor(() => {
      expect(mockFetchUploads).toHaveBeenCalledWith({
        page: 2,
        page_size: 10,
        status: "failed",
        search: "test",
      });
    });
  });

  it("includes filter values in the fetcher call", async () => {
    mockFetchUploads.mockResolvedValue({ uploads: [] });

    renderHook(() => useUploads(1, 20, { status: "failed", search: "abc" }));

    await waitFor(() => {
      expect(mockFetchUploads).toHaveBeenCalledWith({
        page: 1,
        page_size: 20,
        status: "failed",
        search: "abc",
      });
    });
  });
});
