import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ConstituencySearch } from "@/components/constituencies/constituency-search";

describe("ConstituencySearch", () => {
  it("renders input with placeholder", () => {
    render(<ConstituencySearch value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Search constituencies...")).toBeInTheDocument();
  });

  it("displays the provided value", () => {
    render(<ConstituencySearch value="bedford" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Search constituencies...") as HTMLInputElement;
    expect(input.value).toBe("bedford");
  });

  it("calls onChange after debounce when input changes", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<ConstituencySearch value="" onChange={onChange} />);

    const input = screen.getByPlaceholderText("Search constituencies...");

    // Fire a change event directly (avoids userEvent timer conflicts)
    fireEvent.change(input, { target: { value: "bed" } });

    // Before debounce timeout
    expect(onChange).not.toHaveBeenCalledWith("bed");

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onChange).toHaveBeenCalledWith("bed");
    vi.useRealTimers();
  });

  it("syncs with external value prop changes", () => {
    const { rerender } = render(
      <ConstituencySearch value="initial" onChange={vi.fn()} />,
    );

    const input = screen.getByPlaceholderText("Search constituencies...") as HTMLInputElement;
    expect(input.value).toBe("initial");

    rerender(<ConstituencySearch value="updated" onChange={vi.fn()} />);
    expect(input.value).toBe("updated");
  });
});
