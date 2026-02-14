import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadFiltersBar } from "@/components/upload/upload-filters";

describe("UploadFiltersBar", () => {
  const defaultFilters = {};
  let onFiltersChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onFiltersChange = vi.fn();
  });

  it("renders search input", () => {
    render(
      <UploadFiltersBar filters={defaultFilters} onFiltersChange={onFiltersChange} />,
    );
    expect(screen.getByPlaceholderText("Search by filename...")).toBeInTheDocument();
  });

  it("renders all status filter buttons", () => {
    render(
      <UploadFiltersBar filters={defaultFilters} onFiltersChange={onFiltersChange} />,
    );
    expect(screen.getByRole("button", { name: "All statuses" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Completed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Failed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Processing" })).toBeInTheDocument();
  });

  it("calls onFiltersChange when status button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <UploadFiltersBar filters={defaultFilters} onFiltersChange={onFiltersChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Completed" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ status: "completed" });
  });

  it("clears status filter when 'All statuses' is clicked", async () => {
    const user = userEvent.setup();
    render(
      <UploadFiltersBar
        filters={{ status: "completed" }}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "All statuses" }));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined }),
    );
  });

  it("calls onFiltersChange with search after debounce", async () => {
    const user = userEvent.setup();

    render(
      <UploadFiltersBar filters={defaultFilters} onFiltersChange={onFiltersChange} />,
    );

    const input = screen.getByPlaceholderText("Search by filename...");
    await user.type(input, "election");

    // Wait for debounce (300ms) to fire
    await waitFor(
      () => {
        expect(onFiltersChange).toHaveBeenCalledWith(
          expect.objectContaining({ search: "election" }),
        );
      },
      { timeout: 1000 },
    );
  });

  it("preserves existing filters when changing status", async () => {
    const user = userEvent.setup();
    render(
      <UploadFiltersBar
        filters={{ search: "test" }}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Failed" }));

    expect(onFiltersChange).toHaveBeenCalledWith({
      search: "test",
      status: "failed",
    });
  });
});
