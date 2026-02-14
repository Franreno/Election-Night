import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PartyBadge } from "@/components/shared/party-badge";
import { PARTY_NAMES } from "@/lib/constants";

describe("PartyBadge", () => {
  it("renders party name for known party code", () => {
    render(<PartyBadge partyCode="C" />);
    expect(screen.getByText("Conservative Party")).toBeInTheDocument();
  });

  it("renders party code when name is unknown", () => {
    render(<PartyBadge partyCode="XYZ" />);
    expect(screen.getByText("XYZ")).toBeInTheDocument();
  });

  it("renders all known party names", () => {
    for (const [code, name] of Object.entries(PARTY_NAMES)) {
      const { unmount } = render(<PartyBadge partyCode={code} />);
      expect(screen.getByText(name)).toBeInTheDocument();
      unmount();
    }
  });

  it("applies party color as background style", () => {
    const { container } = render(<PartyBadge partyCode="L" />);
    const badge = container.firstChild as HTMLElement;
    // jsdom normalizes hex to rgb()
    expect(badge.style.backgroundColor).toBe("rgb(220, 36, 31)");
  });

  it("uses fallback color for unknown party", () => {
    const { container } = render(<PartyBadge partyCode="UNKNOWN" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.backgroundColor).toBe("rgb(136, 136, 136)");
  });

  it("uses white text for dark backgrounds", () => {
    const { container } = render(<PartyBadge partyCode="L" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.color).toBe("rgb(255, 255, 255)");
  });

  it("uses black text for light backgrounds", () => {
    const { container } = render(<PartyBadge partyCode="SNP" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.color).toBe("rgb(0, 0, 0)");
  });

  it("applies custom className", () => {
    const { container } = render(<PartyBadge partyCode="C" className="custom-class" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.classList.contains("custom-class")).toBe(true);
  });
});
