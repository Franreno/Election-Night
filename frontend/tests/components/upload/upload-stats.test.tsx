import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseUploadStats = vi.fn();
vi.mock("@/hooks/use-upload-stats", () => ({
  useUploadStats: () => mockUseUploadStats(),
}));

import { UploadStatsCard } from "@/components/upload/upload-stats";

describe("UploadStatsCard", () => {
  it("renders nothing when loading", () => {
    mockUseUploadStats.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<UploadStatsCard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no uploads exist", () => {
    mockUseUploadStats.mockReturnValue({
      data: {
        total_uploads: 0,
        completed: 0,
        failed: 0,
        success_rate: 0,
        total_lines_processed: 0,
      },
      isLoading: false,
    });
    const { container } = render(<UploadStatsCard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders stats when data is available", () => {
    mockUseUploadStats.mockReturnValue({
      data: {
        total_uploads: 10,
        completed: 8,
        failed: 2,
        success_rate: 80.0,
        total_lines_processed: 500,
      },
      isLoading: false,
    });

    render(<UploadStatsCard />);

    expect(screen.getByText("Total Uploads")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });
});
