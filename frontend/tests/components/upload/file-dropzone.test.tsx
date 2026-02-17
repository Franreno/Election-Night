import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UploadProgress, UploadResponse } from "@/lib/types";

// Mock useUploadFile hook
let mockHookReturn: {
  upload: ReturnType<typeof vi.fn>;
  isUploading: boolean;
  error: string | null;
  result: UploadResponse | null;
  progress: UploadProgress | null;
  reset: ReturnType<typeof vi.fn>;
};

vi.mock("@/hooks/use-upload-file", () => ({
  useUploadFile: () => mockHookReturn,
}));

import { FileDropzone } from "@/components/upload/file-dropzone";

beforeEach(() => {
  vi.clearAllMocks();
  mockHookReturn = {
    upload: vi.fn(),
    isUploading: false,
    error: null,
    result: null,
    progress: null,
    reset: vi.fn(),
  };
});

describe("FileDropzone", () => {
  it("renders idle state with drop prompt", () => {
    render(<FileDropzone />);
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /browse files/i }),
    ).toBeInTheDocument();
  });

  it("shows spinner when uploading with no progress", () => {
    mockHookReturn.isUploading = true;
    render(<FileDropzone />);
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();
  });

  it("shows spinner when uploading stage is uploading", () => {
    mockHookReturn.isUploading = true;
    mockHookReturn.progress = { stage: "uploading", percentage: 0 };
    render(<FileDropzone />);
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();
  });

  it("shows progress bar when processing", () => {
    mockHookReturn.isUploading = true;
    mockHookReturn.progress = {
      stage: "processing",
      percentage: 45,
      uploadId: 1,
    };
    render(<FileDropzone />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });

  it("shows different percentage values", () => {
    mockHookReturn.isUploading = true;
    mockHookReturn.progress = {
      stage: "processing",
      percentage: 72,
      uploadId: 1,
    };
    render(<FileDropzone />);
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("shows success state with result", () => {
    mockHookReturn.result = {
      upload_id: 1,
      status: "completed",
      total_lines: 10,
      processed_lines: 8,
      error_lines: 2,
      errors: [],
    };
    render(<FileDropzone />);
    expect(screen.getByText(/upload complete/i)).toBeInTheDocument();
    expect(screen.getByText(/8 lines processed/i)).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockHookReturn.error = "File is empty";
    render(<FileDropzone />);
    expect(screen.getByText("File is empty")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });
});
