import { describe, it, expect } from "vitest";
import {
  buildConstituencyLookup,
  matchConstituency,
  getConstituencyColor,
} from "@/lib/map-utils";
import type { ConstituencySummary } from "@/lib/types";
import { PARTY_COLORS } from "@/lib/constants";

const sampleConstituencies: ConstituencySummary[] = [
  { id: 1, name: "Bedford", winning_party_code: "C", pcon24_code: "E14000539", region_name: "East of England" },
  { id: 2, name: "Sheffield Hallam", winning_party_code: "L", pcon24_code: "E14000921", region_name: "Yorkshire" },
  { id: 3, name: "No Code", winning_party_code: null, pcon24_code: null, region_name: null },
];

describe("buildConstituencyLookup", () => {
  it("indexes by normalized name", () => {
    const lookup = buildConstituencyLookup(sampleConstituencies);
    expect(lookup.get("bedford")).toEqual({
      id: 1,
      name: "Bedford",
      winning_party_code: "C",
      region_name: "East of England",
    });
  });

  it("indexes by pcon24_code", () => {
    const lookup = buildConstituencyLookup(sampleConstituencies);
    expect(lookup.get("E14000539")).toEqual({
      id: 1,
      name: "Bedford",
      winning_party_code: "C",
      region_name: "East of England",
    });
  });

  it("skips pcon24_code indexing when null", () => {
    const lookup = buildConstituencyLookup(sampleConstituencies);
    // Only normalized name should be indexed for id=3
    expect(lookup.get("no code")).toBeDefined();
    expect(lookup.has("null")).toBe(false);
  });

  it("handles empty array", () => {
    const lookup = buildConstituencyLookup([]);
    expect(lookup.size).toBe(0);
  });

  it("normalizes accented characters", () => {
    const constituencies: ConstituencySummary[] = [
      { id: 10, name: "Ynys Môn", winning_party_code: "L", pcon24_code: null, region_name: "Wales" },
    ];
    const lookup = buildConstituencyLookup(constituencies);
    expect(lookup.get("ynys mon")).toBeDefined();
  });
});

describe("matchConstituency", () => {
  it("matches by normalized name", () => {
    const lookup = buildConstituencyLookup(sampleConstituencies);
    const result = matchConstituency("BEDFORD", lookup);
    expect(result?.id).toBe(1);
  });

  it("matches case-insensitively", () => {
    const lookup = buildConstituencyLookup(sampleConstituencies);
    const result = matchConstituency("sheffield hallam", lookup);
    expect(result?.id).toBe(2);
  });

  it("returns undefined for no match", () => {
    const lookup = buildConstituencyLookup(sampleConstituencies);
    const result = matchConstituency("Nonexistent Place", lookup);
    expect(result).toBeUndefined();
  });

  it("trims whitespace", () => {
    const lookup = buildConstituencyLookup(sampleConstituencies);
    const result = matchConstituency("  Bedford  ", lookup);
    expect(result?.id).toBe(1);
  });
});

describe("getConstituencyColor", () => {
  it("returns correct color for known party codes", () => {
    expect(getConstituencyColor("C")).toBe(PARTY_COLORS["C"]);
    expect(getConstituencyColor("L")).toBe(PARTY_COLORS["L"]);
    expect(getConstituencyColor("LD")).toBe(PARTY_COLORS["LD"]);
    expect(getConstituencyColor("UKIP")).toBe(PARTY_COLORS["UKIP"]);
    expect(getConstituencyColor("G")).toBe(PARTY_COLORS["G"]);
    expect(getConstituencyColor("SNP")).toBe(PARTY_COLORS["SNP"]);
    expect(getConstituencyColor("Ind")).toBe(PARTY_COLORS["Ind"]);
  });

  it("returns no-data color for null", () => {
    expect(getConstituencyColor(null)).toBe("#2a2a2e");
  });

  it("returns no-data color for undefined", () => {
    expect(getConstituencyColor(undefined)).toBe("#2a2a2e");
  });

  it("returns no-data color for unknown party code", () => {
    expect(getConstituencyColor("UNKNOWN")).toBe("#2a2a2e");
  });
});
