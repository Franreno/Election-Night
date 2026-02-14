import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock SWR mutate
const mockMutate = vi.fn();
vi.mock("swr", async () => {
  const actual = await vi.importActual("swr");
  return {
    ...actual,
    mutate: (...args: unknown[]) => mockMutate(...args),
  };
});

// Mock api
const mockUploadFile = vi.fn();
vi.mock("@/lib/api", () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}));

import { useUploadFile } from "@/hooks/use-upload-file";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUploadFile", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useUploadFile());
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it("sets isUploading during upload", async () => {
    let resolveUpload: (v: unknown) => void;
    mockUploadFile.mockImplementation(
      () => new Promise((resolve) => { resolveUpload = resolve; }),
    );

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    let uploadPromise: Promise<unknown>;
    act(() => {
      uploadPromise = result.current.upload(file);
    });

    expect(result.current.isUploading).toBe(true);

    await act(async () => {
      resolveUpload!({ upload_id: 1, status: "completed" });
      await uploadPromise;
    });

    expect(result.current.isUploading).toBe(false);
  });

  it("sets result on successful upload", async () => {
    const response = { upload_id: 1, status: "completed", processed_lines: 10, error_lines: 0 };
    mockUploadFile.mockResolvedValue(response);

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.result).toEqual(response);
    expect(result.current.error).toBeNull();
  });

  it("invalidates SWR caches after successful upload", async () => {
    mockUploadFile.mockResolvedValue({ upload_id: 1 });

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    await act(async () => {
      await result.current.upload(file);
    });

    expect(mockMutate).toHaveBeenCalled();
  });

  it("sets error on upload failure", async () => {
    mockUploadFile.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    await act(async () => {
      try {
        await result.current.upload(file);
      } catch {
        // expected
      }
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.result).toBeNull();
    expect(result.current.isUploading).toBe(false);
  });

  it("sets generic message for non-Error throws", async () => {
    mockUploadFile.mockRejectedValue("something");

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    await act(async () => {
      try {
        await result.current.upload(file);
      } catch {
        // expected
      }
    });

    expect(result.current.error).toBe("Upload failed");
  });

  it("resets state with reset()", async () => {
    mockUploadFile.mockResolvedValue({ upload_id: 1 });

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("clears previous state before new upload", async () => {
    mockUploadFile.mockRejectedValueOnce(new Error("first error"));
    mockUploadFile.mockResolvedValueOnce({ upload_id: 2 });

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    // First upload fails
    await act(async () => {
      try { await result.current.upload(file); } catch { /* expected */ }
    });
    expect(result.current.error).toBe("first error");

    // Second upload succeeds - error should be cleared
    await act(async () => {
      await result.current.upload(file);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeDefined();
  });
});
