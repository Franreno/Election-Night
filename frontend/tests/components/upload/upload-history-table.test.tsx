import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DeleteProgress, UploadLogEntry } from "@/lib/types";

const mockUploads: UploadLogEntry[] = [
  {
    id: 1,
    filename: "first.txt",
    status: "completed",
    total_lines: 10,
    processed_lines: 10,
    error_lines: 0,
    errors: [],
    started_at: "2024-07-04T22:15:00Z",
    completed_at: "2024-07-04T22:15:01Z",
    deleted_at: null,
  },
  {
    id: 2,
    filename: "second.txt",
    status: "completed",
    total_lines: 5,
    processed_lines: 5,
    error_lines: 0,
    errors: [],
    started_at: "2024-07-04T23:00:00Z",
    completed_at: "2024-07-04T23:00:01Z",
    deleted_at: null,
  },
];

let mockDeleteProgress: DeleteProgress | null = null;
const mockDeleteUpload = vi.fn();

vi.mock("@/hooks/use-uploads", () => ({
  useUploads: () => ({
    data: { total: mockUploads.length, page: 1, page_size: 20, uploads: mockUploads },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-delete-upload", () => ({
  useDeleteUpload: () => ({
    deleteUpload: mockDeleteUpload,
    isDeleting: mockDeleteProgress !== null,
    error: null,
    progress: mockDeleteProgress,
  }),
}));

import { UploadHistoryTable } from "@/components/upload/upload-history-table";

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteProgress = null;
});

describe("UploadHistoryTable", () => {
  it("renders uploads table rows", () => {
    render(<UploadHistoryTable />);
    expect(screen.getByText("first.txt")).toBeInTheDocument();
    expect(screen.getByText("second.txt")).toBeInTheDocument();
  });

  it("shows progress bar in row during rolling_back", () => {
    mockDeleteProgress = {
      stage: "rolling_back",
      percentage: 50,
      uploadId: 1,
    };
    render(<UploadHistoryTable />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it("shows progress bar in deleting stage", () => {
    mockDeleteProgress = {
      stage: "deleting",
      percentage: 0,
      uploadId: 2,
    };
    render(<UploadHistoryTable />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("disables delete buttons during delete operation", () => {
    mockDeleteProgress = {
      stage: "rolling_back",
      percentage: 25,
      uploadId: 1,
    };
    render(<UploadHistoryTable />);
    const deleteButtons = screen.getAllByTitle(/delete/i);
    deleteButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
