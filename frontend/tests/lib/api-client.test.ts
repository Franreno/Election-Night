import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, ApiError } from "@/lib/api-client";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ApiError", () => {
  it("stores status and message", () => {
    const err = new ApiError(404, "Not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("apiFetch", () => {
  it("returns parsed JSON on success", async () => {
    const data = { id: 1, name: "test" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(data),
      }),
    );

    const result = await apiFetch("/api/test");
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/api/test", undefined);
  });

  it("passes RequestInit options", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const init = { method: "POST", body: "test" };
    await apiFetch("/api/test", init);
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/api/test", init);
  });

  it("throws ApiError with detail from JSON body on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: () => Promise.resolve({ detail: "Invalid data" }),
      }),
    );

    await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
    try {
      await apiFetch("/api/test");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(422);
      expect((err as ApiError).message).toBe("Invalid data");
    }
  });

  it("falls back to statusText when JSON parsing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("not json")),
      }),
    );

    await expect(apiFetch("/api/test")).rejects.toThrow("Internal Server Error");
  });

  it("uses statusText when detail is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: () => Promise.resolve({ detail: "" }),
      }),
    );

    await expect(apiFetch("/api/test")).rejects.toThrow("Not Found");
  });
});
