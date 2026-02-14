import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockDeleteUpload = vi.fn();
const mockMutate = vi.fn();

vi.mock("@/lib/api", () => ({
  deleteUpload: (id: number) => mockDeleteUpload(id),
}));

vi.mock("swr", async () => {
  const actual = await vi.importActual("swr");
  return {
    ...actual,
    useSWRConfig: () => ({ mutate: mockMutate }),
  };
});

import { useDeleteUpload } from "@/hooks/use-delete-upload";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDeleteUpload", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useDeleteUpload());
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("calls deleteUpload API with correct id", async () => {
    mockDeleteUpload.mockResolvedValue(undefined);
    mockMutate.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteUpload());

    await act(async () => {
      await result.current.deleteUpload(42);
    });

    expect(mockDeleteUpload).toHaveBeenCalledWith(42);
  });

  it("revalidates SWR caches after successful delete", async () => {
    mockDeleteUpload.mockResolvedValue(undefined);
    mockMutate.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteUpload());

    await act(async () => {
      await result.current.deleteUpload(1);
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      { revalidate: true },
    );

    // Verify the matcher function matches "uploads-..." keys
    const matcherFn = mockMutate.mock.calls[0][0];
    expect(matcherFn("uploads-1-20-")).toBe(true);
    expect(matcherFn("upload-stats")).toBe(false);
    expect(matcherFn("constituencies")).toBe(false);
  });

  it("sets error on delete failure", async () => {
    mockDeleteUpload.mockRejectedValue(new Error("Upload not found"));

    const { result } = renderHook(() => useDeleteUpload());

    await act(async () => {
      try {
        await result.current.deleteUpload(999);
      } catch {
        // expected
      }
    });

    expect(result.current.error).toBe("Upload not found");
    expect(result.current.isDeleting).toBe(false);
  });

  it("resets isDeleting after completion", async () => {
    mockDeleteUpload.mockResolvedValue(undefined);
    mockMutate.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteUpload());

    await act(async () => {
      await result.current.deleteUpload(1);
    });

    expect(result.current.isDeleting).toBe(false);
  });
});
