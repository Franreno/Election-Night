import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
  ApiError: class extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

import {
  fetchUploads,
  deleteUpload,
  fetchUploadStats,
} from "@/lib/api";
import { apiFetch } from "@/lib/api-client";

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchUploads with filters", () => {
  it("passes status filter param", async () => {
    mockApiFetch.mockResolvedValue({ uploads: [] });
    await fetchUploads({ status: "completed" });
    const call = mockApiFetch.mock.calls[0][0] as string;
    expect(call).toContain("status=completed");
  });

  it("passes search filter param", async () => {
    mockApiFetch.mockResolvedValue({ uploads: [] });
    await fetchUploads({ search: "election" });
    const call = mockApiFetch.mock.calls[0][0] as string;
    expect(call).toContain("search=election");
  });

  it("passes combined page, status, and search params", async () => {
    mockApiFetch.mockResolvedValue({ uploads: [] });
    await fetchUploads({ page: 2, page_size: 10, status: "failed", search: "test" });
    const call = mockApiFetch.mock.calls[0][0] as string;
    expect(call).toContain("page=2");
    expect(call).toContain("page_size=10");
    expect(call).toContain("status=failed");
    expect(call).toContain("search=test");
  });

  it("omits undefined filter params", async () => {
    mockApiFetch.mockResolvedValue({ uploads: [] });
    await fetchUploads({ page: 1 });
    const call = mockApiFetch.mock.calls[0][0] as string;
    expect(call).not.toContain("status=");
    expect(call).not.toContain("search=");
  });
});

describe("deleteUpload", () => {
  it("sends DELETE request to correct endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Upload deleted" }),
      }),
    );

    await deleteUpload(42);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/uploads/42"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws on delete failure with detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Not Found",
        json: () => Promise.resolve({ detail: "Upload not found" }),
      }),
    );

    await expect(deleteUpload(999)).rejects.toThrow("Upload not found");
  });

  it("falls back to statusText when JSON fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Server Error",
        json: () => Promise.reject(new Error("not json")),
      }),
    );

    await expect(deleteUpload(1)).rejects.toThrow("Server Error");
  });
});

describe("fetchUploadStats", () => {
  it("calls apiFetch with correct endpoint", async () => {
    const mockStats = {
      total_uploads: 5,
      completed: 4,
      failed: 1,
      success_rate: 80.0,
      total_lines_processed: 500,
    };
    mockApiFetch.mockResolvedValue(mockStats);

    const result = await fetchUploadStats();

    expect(mockApiFetch).toHaveBeenCalledWith("/api/uploads/stats");
    expect(result).toEqual(mockStats);
  });
});
