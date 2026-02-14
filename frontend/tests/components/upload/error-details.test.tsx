import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorDetails } from "@/components/upload/error-details";

describe("ErrorDetails", () => {
  it("renders nothing when errors array is empty", () => {
    const { container } = render(<ErrorDetails errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders error count button", () => {
    const errors = [
      { line: 1, error: "Invalid format" },
      { line: 2, error: "No matching constituency for 'Nowhere'" },
    ];
    render(<ErrorDetails errors={errors} />);
    expect(screen.getByRole("button", { name: /2 errors/i })).toBeInTheDocument();
  });

  it("renders singular 'error' for single error", () => {
    render(<ErrorDetails errors={[{ line: 1, error: "Bad line" }]} />);
    expect(screen.getByRole("button", { name: /1 error$/i })).toBeInTheDocument();
  });

  it("opens dialog when button is clicked", async () => {
    const user = userEvent.setup();
    const errors = [
      { line: 5, error: "No matching constituency for 'FakePlace'" },
    ];
    render(<ErrorDetails errors={errors} />);

    await user.click(screen.getByRole("button", { name: /1 error/i }));

    expect(screen.getByText("Upload Errors")).toBeInTheDocument();
    expect(screen.getByText(/1 total/i)).toBeInTheDocument();
  });

  it("categorizes constituency errors correctly", async () => {
    const user = userEvent.setup();
    const errors = [
      { line: 0, error: "No matching constituency for 'Nowhere'" },
      { line: 0, error: "No matching constituency for 'FakePlace'" },
      { line: 3, error: "Invalid vote count" },
    ];
    render(<ErrorDetails errors={errors} />);

    await user.click(screen.getByRole("button", { name: /3 errors/i }));

    expect(screen.getByText("Constituency not found")).toBeInTheDocument();
    expect(screen.getByText("Format errors")).toBeInTheDocument();
    // Check counts in badges
    expect(screen.getByText(/Constituency not found: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Format errors: 1/)).toBeInTheDocument();
  });

  it("shows explanatory text for each category", async () => {
    const user = userEvent.setup();
    const errors = [
      { line: 0, error: "No matching constituency for 'X'" },
    ];
    render(<ErrorDetails errors={errors} />);

    await user.click(screen.getByRole("button", { name: /1 error/i }));

    expect(
      screen.getByText(/could not be matched to any official 2024 constituency/i),
    ).toBeInTheDocument();
  });

  it("shows line numbers when line > 0", async () => {
    const user = userEvent.setup();
    const errors = [{ line: 42, error: "Expected even number of vote/party pairs" }];
    render(<ErrorDetails errors={errors} />);

    await user.click(screen.getByRole("button", { name: /1 error/i }));

    expect(screen.getByText("Line 42")).toBeInTheDocument();
  });

  it("hides line number when line is 0", async () => {
    const user = userEvent.setup();
    const errors = [{ line: 0, error: "No matching constituency for 'Test'" }];
    render(<ErrorDetails errors={errors} />);

    await user.click(screen.getByRole("button", { name: /1 error/i }));

    expect(screen.queryByText(/Line 0/)).not.toBeInTheDocument();
  });

  it("categorizes format errors with various keywords", async () => {
    const user = userEvent.setup();
    const errors = [
      { line: 1, error: "Expected at least 3 fields" },
      { line: 2, error: "Duplicate party code: L" },
      { line: 3, error: "Unknown party code: ZZZ" },
      { line: 4, error: "Vote count must be a non-negative integer" },
    ];
    render(<ErrorDetails errors={errors} />);

    await user.click(screen.getByRole("button", { name: /4 errors/i }));

    expect(screen.getByText(/Format errors: 4/)).toBeInTheDocument();
  });
});
