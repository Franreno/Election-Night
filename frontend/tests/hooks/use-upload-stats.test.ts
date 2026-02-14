import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import React from "react";

const mockFetchUploadStats = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchUploadStats: () => mockFetchUploadStats(),
}));

vi.mock("@/lib/constants", () => ({
  UPLOAD_POLLING_INTERVAL_MS: 0,
}));

import { useUploadStats } from "@/hooks/use-upload-stats";

// Wrapper that provides a fresh SWR cache per test
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    SWRConfig,
    { value: { provider: () => new Map() } },
    children,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUploadStats", () => {
  it("fetches upload statistics", async () => {
    const mockData = {
      total_uploads: 10,
      completed: 8,
      failed: 2,
      success_rate: 80.0,
      total_lines_processed: 500,
    };
    mockFetchUploadStats.mockResolvedValue(mockData);

    const { result } = renderHook(() => useUploadStats(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(mockFetchUploadStats).toHaveBeenCalled();
  });

  it("calls fetchUploadStats on mount", async () => {
    mockFetchUploadStats.mockResolvedValue({
      total_uploads: 0, completed: 0, failed: 0, success_rate: 0, total_lines_processed: 0,
    });

    renderHook(() => useUploadStats(), { wrapper });

    await waitFor(() => {
      expect(mockFetchUploadStats).toHaveBeenCalledTimes(1);
    });
  });
});
