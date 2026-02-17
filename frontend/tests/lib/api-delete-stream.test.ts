import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function mockSSEStream(
  events: Array<{ event: string; data: object }>,
): ReadableStream<Uint8Array> {
  const text = events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

import { deleteUploadStream } from "@/lib/api";

describe("deleteUploadStream", () => {
  it("calls DELETE /api/uploads/{id}/stream", async () => {
    const events = [
      { event: "started", data: { event: "started", upload_id: 1, total_affected: 0 } },
      { event: "complete", data: { event: "complete", upload_id: 1, message: "Upload deleted", rolled_back: 0 } },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: mockSSEStream(events),
      }),
    );

    const onEvent = vi.fn();
    await deleteUploadStream(1, onEvent);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/uploads/1/stream"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("calls onEvent for each SSE event in order", async () => {
    const events = [
      { event: "started", data: { event: "started", upload_id: 1, total_affected: 2 } },
      { event: "progress", data: { event: "progress", processed: 1, total: 2, percentage: 50 } },
      { event: "progress", data: { event: "progress", processed: 2, total: 2, percentage: 100 } },
      { event: "complete", data: { event: "complete", upload_id: 1, message: "Upload deleted", rolled_back: 2 } },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: mockSSEStream(events),
      }),
    );

    const onEvent = vi.fn();
    await deleteUploadStream(1, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(4);
    expect(onEvent.mock.calls[0][0].event).toBe("started");
    expect(onEvent.mock.calls[1][0].event).toBe("progress");
    expect(onEvent.mock.calls[1][0].percentage).toBe(50);
    expect(onEvent.mock.calls[2][0].percentage).toBe(100);
    expect(onEvent.mock.calls[3][0].event).toBe("complete");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Not Found",
        json: () => Promise.resolve({ detail: "Upload not found" }),
      }),
    );

    const onEvent = vi.fn();
    await expect(deleteUploadStream(99, onEvent)).rejects.toThrow("Upload not found");
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("falls back to statusText when JSON parsing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("not json")),
      }),
    );

    const onEvent = vi.fn();
    await expect(deleteUploadStream(1, onEvent)).rejects.toThrow(
      "Internal Server Error",
    );
  });

  it("handles error event from stream", async () => {
    const events = [
      { event: "started", data: { event: "started", upload_id: 1, total_affected: 1 } },
      { event: "error", data: { event: "error", upload_id: 1, detail: "DB failure" } },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: mockSSEStream(events),
      }),
    );

    const onEvent = vi.fn();
    await deleteUploadStream(1, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[1][0].event).toBe("error");
    expect(onEvent.mock.calls[1][0].detail).toBe("DB failure");
  });
});
