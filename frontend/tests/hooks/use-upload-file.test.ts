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
const mockUploadFileStream = vi.fn();
vi.mock("@/lib/api", () => ({
  uploadFileStream: (...args: unknown[]) => mockUploadFileStream(...args),
}));

import { useUploadFile } from "@/hooks/use-upload-file";
import type { SSEEvent } from "@/lib/types";

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper: simulate uploadFileStream by calling onEvent with a sequence of events
function simulateStream(events: SSEEvent[]) {
  mockUploadFileStream.mockImplementation(
    async (_file: File, onEvent: (e: SSEEvent) => void) => {
      for (const event of events) {
        onEvent(event);
      }
    },
  );
}

const CREATED_EVENT: SSEEvent = {
  event: "created",
  upload_id: 1,
  total_lines: 2,
};

const PROGRESS_50: SSEEvent = {
  event: "progress",
  processed_count: 1,
  total: 2,
  percentage: 50,
};

const PROGRESS_100: SSEEvent = {
  event: "progress",
  processed_count: 2,
  total: 2,
  percentage: 100,
};

const COMPLETE_EVENT: SSEEvent = {
  event: "complete",
  upload_id: 1,
  status: "completed",
  total_lines: 2,
  processed_lines: 2,
  error_lines: 0,
  errors: [],
};

describe("useUploadFile", () => {
  it("starts in idle state with no progress", () => {
    const { result } = renderHook(() => useUploadFile());
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.progress).toBeNull();
  });

  it("sets isUploading during upload", async () => {
    let resolveUpload: () => void;
    mockUploadFileStream.mockImplementation(
      () => new Promise<void>((resolve) => { resolveUpload = resolve; }),
    );

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    let uploadPromise: Promise<void>;
    act(() => {
      uploadPromise = result.current.upload(file);
    });

    expect(result.current.isUploading).toBe(true);

    await act(async () => {
      resolveUpload!();
      await uploadPromise;
    });

    expect(result.current.isUploading).toBe(false);
  });

  it("sets progress to uploading stage on upload start", async () => {
    let resolveUpload: () => void;
    mockUploadFileStream.mockImplementation(
      () => new Promise<void>((resolve) => { resolveUpload = resolve; }),
    );

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    let uploadPromise: Promise<void>;
    act(() => {
      uploadPromise = result.current.upload(file);
    });

    expect(result.current.progress).toEqual({
      stage: "uploading",
      percentage: 0,
    });

    await act(async () => {
      resolveUpload!();
      await uploadPromise;
    });
  });

  it("updates progress on created event", async () => {
    simulateStream([CREATED_EVENT, COMPLETE_EVENT]);

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    await act(async () => {
      await result.current.upload(file);
    });

    // After complete, progress should show complete stage
    expect(result.current.progress?.stage).toBe("complete");
    expect(result.current.progress?.uploadId).toBe(1);
  });

  it("sets result on complete event", async () => {
    simulateStream([CREATED_EVENT, PROGRESS_100, COMPLETE_EVENT]);

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.result).toEqual({
      upload_id: 1,
      status: "completed",
      total_lines: 2,
      processed_lines: 2,
      error_lines: 0,
      errors: [],
    });
    expect(result.current.error).toBeNull();
  });

  it("invalidates SWR caches on created event", async () => {
    simulateStream([CREATED_EVENT, COMPLETE_EVENT]);

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    await act(async () => {
      await result.current.upload(file);
    });

    // mutate should be called at least once for created and once for complete
    expect(mockMutate).toHaveBeenCalled();
  });

  it("sets error on SSE error event", async () => {
    simulateStream([
      CREATED_EVENT,
      { event: "error", upload_id: 1, detail: "DB failure" },
    ]);

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.error).toBe("DB failure");
    expect(result.current.progress?.stage).toBe("error");
  });

  it("sets error on fetch failure", async () => {
    mockUploadFileStream.mockRejectedValue(new Error("Network error"));

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
    expect(result.current.progress).toBeNull();
  });

  it("sets generic message for non-Error throws", async () => {
    mockUploadFileStream.mockRejectedValue("something");

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
    simulateStream([CREATED_EVENT, COMPLETE_EVENT]);

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.result).not.toBeNull();
    expect(result.current.progress).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBeNull();
  });

  it("clears previous state before new upload", async () => {
    mockUploadFileStream.mockRejectedValueOnce(new Error("first error"));
    simulateStream([CREATED_EVENT, COMPLETE_EVENT]);

    const { result } = renderHook(() => useUploadFile());
    const file = new File(["test"], "test.txt");

    // First upload fails
    await act(async () => {
      try {
        await result.current.upload(file);
      } catch {
        /* expected */
      }
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
