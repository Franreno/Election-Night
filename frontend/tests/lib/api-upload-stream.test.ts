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

// Import after mocking is not needed here since we're stubbing fetch globally
import { uploadFileStream } from "@/lib/api";

describe("uploadFileStream", () => {
  it("calls POST /api/upload/stream with FormData", async () => {
    const events = [
      { event: "created", data: { event: "created", upload_id: 1, total_lines: 1 } },
      { event: "complete", data: { event: "complete", upload_id: 1, status: "completed", total_lines: 1, processed_lines: 1, error_lines: 0, errors: [] } },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: mockSSEStream(events),
      }),
    );

    const onEvent = vi.fn();
    const file = new File(["Bedford,100,C"], "test.txt");
    await uploadFileStream(file, onEvent);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/upload/stream"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls onEvent for each SSE event in order", async () => {
    const events = [
      { event: "created", data: { event: "created", upload_id: 1, total_lines: 2 } },
      { event: "progress", data: { event: "progress", processed_count: 1, total: 2, percentage: 50 } },
      { event: "progress", data: { event: "progress", processed_count: 2, total: 2, percentage: 100 } },
      { event: "complete", data: { event: "complete", upload_id: 1, status: "completed", total_lines: 2, processed_lines: 2, error_lines: 0, errors: [] } },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: mockSSEStream(events),
      }),
    );

    const onEvent = vi.fn();
    const file = new File(["test"], "test.txt");
    await uploadFileStream(file, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(4);
    expect(onEvent.mock.calls[0][0].event).toBe("created");
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
        statusText: "Bad Request",
        json: () => Promise.resolve({ detail: "File is empty" }),
      }),
    );

    const onEvent = vi.fn();
    const file = new File([""], "test.txt");
    await expect(uploadFileStream(file, onEvent)).rejects.toThrow("File is empty");
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
    const file = new File(["data"], "test.txt");
    await expect(uploadFileStream(file, onEvent)).rejects.toThrow(
      "Internal Server Error",
    );
  });

  it("handles error event from stream", async () => {
    const events = [
      { event: "created", data: { event: "created", upload_id: 1, total_lines: 1 } },
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
    const file = new File(["test"], "test.txt");
    await uploadFileStream(file, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[1][0].event).toBe("error");
    expect(onEvent.mock.calls[1][0].detail).toBe("DB failure");
  });

  it("handles chunked SSE data across multiple reads", async () => {
    // Simulate data arriving in chunks that split across event boundaries
    const fullText =
      'event: created\ndata: {"event":"created","upload_id":1,"total_lines":1}\n\n' +
      'event: complete\ndata: {"event":"complete","upload_id":1,"status":"completed","total_lines":1,"processed_lines":1,"error_lines":0,"errors":[]}\n\n';

    const chunks = [
      fullText.slice(0, 30),
      fullText.slice(30),
    ];

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, body }),
    );

    const onEvent = vi.fn();
    const file = new File(["test"], "test.txt");
    await uploadFileStream(file, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[0][0].event).toBe("created");
    expect(onEvent.mock.calls[1][0].event).toBe("complete");
  });
});
