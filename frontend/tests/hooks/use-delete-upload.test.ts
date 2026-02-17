import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockDeleteUploadStream = vi.fn();
const mockMutate = vi.fn();

vi.mock("@/lib/api", () => ({
  deleteUploadStream: (...args: unknown[]) => mockDeleteUploadStream(...args),
}));

vi.mock("swr", async () => {
  const actual = await vi.importActual("swr");
  return {
    ...actual,
    useSWRConfig: () => ({ mutate: mockMutate }),
  };
});

import { useDeleteUpload } from "@/hooks/use-delete-upload";
import type { DeleteSSEEvent } from "@/lib/types";

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper: simulate deleteUploadStream by calling onEvent with a sequence
function simulateStream(events: DeleteSSEEvent[]) {
  mockDeleteUploadStream.mockImplementation(
    async (_id: number, onEvent: (e: DeleteSSEEvent) => void) => {
      for (const event of events) {
        onEvent(event);
      }
    },
  );
}

const STARTED_EVENT: DeleteSSEEvent = {
  event: "started",
  upload_id: 1,
  total_affected: 2,
};

const PROGRESS_50: DeleteSSEEvent = {
  event: "progress",
  processed: 1,
  total: 2,
  percentage: 50,
};

const PROGRESS_100: DeleteSSEEvent = {
  event: "progress",
  processed: 2,
  total: 2,
  percentage: 100,
};

const COMPLETE_EVENT: DeleteSSEEvent = {
  event: "complete",
  upload_id: 1,
  message: "Upload deleted",
  rolled_back: 2,
};

describe("useDeleteUpload", () => {
  it("starts in idle state with no progress", () => {
    const { result } = renderHook(() => useDeleteUpload());
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBeNull();
  });

  it("sets isDeleting during delete", async () => {
    let resolveDelete: () => void;
    mockDeleteUploadStream.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelete = resolve; }),
    );

    const { result } = renderHook(() => useDeleteUpload());

    let deletePromise: Promise<void>;
    act(() => {
      deletePromise = result.current.deleteUpload(1);
    });

    expect(result.current.isDeleting).toBe(true);

    await act(async () => {
      resolveDelete!();
      await deletePromise;
    });

    expect(result.current.isDeleting).toBe(false);
  });

  it("sets progress to deleting stage on start", async () => {
    let resolveDelete: () => void;
    mockDeleteUploadStream.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelete = resolve; }),
    );

    const { result } = renderHook(() => useDeleteUpload());

    let deletePromise: Promise<void>;
    act(() => {
      deletePromise = result.current.deleteUpload(1);
    });

    expect(result.current.progress).toEqual({
      stage: "deleting",
      percentage: 0,
    });

    await act(async () => {
      resolveDelete!();
      await deletePromise;
    });
  });

  it("updates progress on started event", async () => {
    simulateStream([STARTED_EVENT, COMPLETE_EVENT]);

    const { result } = renderHook(() => useDeleteUpload());

    await act(async () => {
      await result.current.deleteUpload(1);
    });

    // After complete, progress should show complete stage
    expect(result.current.progress?.stage).toBe("complete");
    expect(result.current.progress?.uploadId).toBe(1);
  });

  it("updates progress percentage on progress events", async () => {
    simulateStream([STARTED_EVENT, PROGRESS_50, PROGRESS_100, COMPLETE_EVENT]);

    const { result } = renderHook(() => useDeleteUpload());

    await act(async () => {
      await result.current.deleteUpload(1);
    });

    expect(result.current.progress?.stage).toBe("complete");
    expect(result.current.progress?.percentage).toBe(100);
  });

  it("revalidates all SWR caches on complete", async () => {
    simulateStream([STARTED_EVENT, COMPLETE_EVENT]);

    const { result } = renderHook(() => useDeleteUpload());

    await act(async () => {
      await result.current.deleteUpload(1);
    });

    // Should revalidate with a broad matcher (all keys)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      { revalidate: true },
    );
  });

  it("sets error on SSE error event", async () => {
    simulateStream([
      STARTED_EVENT,
      { event: "error", upload_id: 1, detail: "DB failure" },
    ]);

    const { result } = renderHook(() => useDeleteUpload());

    await act(async () => {
      try {
        await result.current.deleteUpload(1);
      } catch {
        // expected
      }
    });

    expect(result.current.error).toBe("DB failure");
    expect(result.current.progress?.stage).toBe("error");
  });

  it("sets error on fetch failure", async () => {
    mockDeleteUploadStream.mockRejectedValue(new Error("Upload not found"));

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
    expect(result.current.progress).toBeNull();
  });

  it("resets isDeleting after completion", async () => {
    simulateStream([STARTED_EVENT, COMPLETE_EVENT]);
    mockMutate.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteUpload());

    await act(async () => {
      await result.current.deleteUpload(1);
    });

    expect(result.current.isDeleting).toBe(false);
  });
});
