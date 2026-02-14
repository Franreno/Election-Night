import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteUploadDialog } from "@/components/upload/delete-upload-dialog";

describe("DeleteUploadDialog", () => {
  it("renders delete trigger button", () => {
    render(
      <DeleteUploadDialog uploadId={1} filename="test.txt" onConfirm={vi.fn()} />,
    );
    // The trigger button has a title attribute
    expect(screen.getByTitle("Delete upload")).toBeInTheDocument();
  });

  it("disables button when disabled prop is true", () => {
    render(
      <DeleteUploadDialog
        uploadId={1}
        filename="test.txt"
        disabled={true}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByTitle("Cannot delete processing upload")).toBeDisabled();
  });

  it("opens confirmation dialog on click", async () => {
    const user = userEvent.setup();
    render(
      <DeleteUploadDialog uploadId={1} filename="test.txt" onConfirm={vi.fn()} />,
    );

    await user.click(screen.getByTitle("Delete upload"));

    expect(screen.getByText("Delete upload?")).toBeInTheDocument();
    expect(screen.getByText(/test\.txt/)).toBeInTheDocument();
  });

  it("shows fallback text when filename is null", async () => {
    const user = userEvent.setup();
    render(
      <DeleteUploadDialog uploadId={1} filename={null} onConfirm={vi.fn()} />,
    );

    await user.click(screen.getByTitle("Delete upload"));

    // "this upload" appears in both the span and the surrounding description
    const matches = screen.getAllByText(/this upload/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("calls onConfirm with uploadId when confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeleteUploadDialog uploadId={42} filename="data.txt" onConfirm={onConfirm} />,
    );

    await user.click(screen.getByTitle("Delete upload"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledWith(42);
  });

  it("does not call onConfirm when cancelled", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeleteUploadDialog uploadId={1} filename="test.txt" onConfirm={onConfirm} />,
    );

    await user.click(screen.getByTitle("Delete upload"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
