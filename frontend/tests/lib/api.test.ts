import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock api-client before importing api module
vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
  ApiError: class extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

import {
  fetchTotals,
  fetchConstituencies,
  fetchConstituency,
  fetchUploads,
  uploadFile,
  fetchConstituenciesSummary,
  fetchHealth,
  fetchRegions,
  fetchRegionDetail,
} from "@/lib/api";
import { apiFetch } from "@/lib/api-client";

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchTotals", () => {
  it("calls apiFetch with /api/totals", async () => {
    mockApiFetch.mockResolvedValue({ total_votes: 100 });
    const result = await fetchTotals();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/totals");
    expect(result).toEqual({ total_votes: 100 });
  });
});

describe("fetchConstituencies", () => {
  it("builds query string from params", async () => {
    mockApiFetch.mockResolvedValue({ constituencies: [] });
    await fetchConstituencies({
      search: "bedford",
      page: 2,
      page_size: 10,
      sort_by: "name",
      sort_dir: "asc",
    });
    const call = mockApiFetch.mock.calls[0][0] as string;
    expect(call).toContain("search=bedford");
    expect(call).toContain("page=2");
    expect(call).toContain("page_size=10");
    expect(call).toContain("sort_by=name");
    expect(call).toContain("sort_dir=asc");
  });

  it("omits undefined params", async () => {
    mockApiFetch.mockResolvedValue({ constituencies: [] });
    await fetchConstituencies({ page: 1 });
    const call = mockApiFetch.mock.calls[0][0] as string;
    expect(call).toContain("page=1");
    expect(call).not.toContain("search=");
    expect(call).not.toContain("sort_by=");
  });

  it("omits empty search string", async () => {
    mockApiFetch.mockResolvedValue({ constituencies: [] });
    await fetchConstituencies({ search: "" });
    const call = mockApiFetch.mock.calls[0][0] as string;
    expect(call).not.toContain("search=");
  });
});

describe("fetchConstituency", () => {
  it("calls with correct id path", async () => {
    mockApiFetch.mockResolvedValue({ id: 5 });
    await fetchConstituency(5);
    expect(mockApiFetch).toHaveBeenCalledWith("/api/constituencies/5");
  });
});

describe("fetchUploads", () => {
  it("builds query with page params", async () => {
    mockApiFetch.mockResolvedValue({ uploads: [] });
    await fetchUploads({ page: 3, page_size: 25 });
    const call = mockApiFetch.mock.calls[0][0] as string;
    expect(call).toContain("page=3");
    expect(call).toContain("page_size=25");
  });

  it("works without params", async () => {
    mockApiFetch.mockResolvedValue({ uploads: [] });
    await fetchUploads();
    const call = mockApiFetch.mock.calls[0][0] as string;
    expect(call).toContain("/api/uploads");
  });
});

describe("uploadFile", () => {
  it("sends file as FormData via POST", async () => {
    const mockResponse = { upload_id: 1, status: "completed" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const file = new File(["test content"], "test.txt", { type: "text/plain" });
    const result = await uploadFile(file);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/upload"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("throws on upload failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Bad Request",
        json: () => Promise.resolve({ detail: "Invalid file" }),
      }),
    );

    const file = new File(["bad"], "bad.txt");
    await expect(uploadFile(file)).rejects.toThrow("Invalid file");
  });

  it("falls back to statusText when JSON parsing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Server Error",
        json: () => Promise.reject(new Error("not json")),
      }),
    );

    const file = new File(["bad"], "bad.txt");
    // Source uses: body.detail || "Upload failed", and catch returns { detail: res.statusText }
    await expect(uploadFile(file)).rejects.toThrow("Server Error");
  });
});

describe("fetchConstituenciesSummary", () => {
  it("calls correct endpoint", async () => {
    mockApiFetch.mockResolvedValue({ constituencies: [] });
    await fetchConstituenciesSummary();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/constituencies/summary");
  });
});

describe("fetchHealth", () => {
  it("calls correct endpoint", async () => {
    mockApiFetch.mockResolvedValue({ status: "ok" });
    await fetchHealth();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/health");
  });
});

describe("fetchRegions", () => {
  it("calls correct endpoint", async () => {
    mockApiFetch.mockResolvedValue({ regions: [] });
    await fetchRegions();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/geography/regions");
  });
});

describe("fetchRegionDetail", () => {
  it("calls with region id", async () => {
    mockApiFetch.mockResolvedValue({ id: 3, name: "London" });
    await fetchRegionDetail(3);
    expect(mockApiFetch).toHaveBeenCalledWith("/api/geography/regions/3");
  });
});
