"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { parliamentChart } from "d3-parliament-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PartyTotals } from "@/lib/types";
import { PARTY_COLORS } from "@/lib/constants";

interface HemicycleProps {
  parties: PartyTotals[];
}

const MAJORITY_THRESHOLD = 326;
const CHART_WIDTH = 700;

export function Hemicycle({ parties }: HemicycleProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(CHART_WIDTH);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(Math.min(width, CHART_WIDTH));
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    if (!svgRef.current || parties.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Use container width for responsive sizing
    const chartWidth = containerWidth;

    // Transform party data to d3-parliament-chart format
    const chartData = parties.map((party) => ({
      seats: party.seats,
      color: PARTY_COLORS[party.party_code] ?? "#2a2a2e",
      party: party.party_name,
      partyCode: party.party_code,
    }));

    // Aggressive sizing for mobile to fit all 650 seats
    const isMobile = chartWidth < 500;
    const seatRadius = isMobile ? 2.2 : 4.5;
    const rowHeight = isMobile ? 7 : 11;
    const sectionGap = isMobile ? 30 : 60;

    // Create parliament chart with responsive width
    const chart = parliamentChart(chartData, chartWidth)
      .aggregatedData(chartData)
      .seatRadius(seatRadius)
      .rowHeight(rowHeight)
      .sectionGap(sectionGap);

    // Render chart
    const g = d3.select(svgRef.current).append("g");
    g.call(chart as any);

    // Get processed data with x/y coordinates
    const processedData = chart.data();

    // Add tooltips and interactivity
    g.selectAll("circle")
      .data(processedData)
      .on("mouseenter", function (event, d: any) {
        d3.select(this).attr("opacity", 0.7);

        const party = chartData.find((p) => p.color === d.color);
        if (party) {
          d3.select("body")
            .append("div")
            .attr("class", "parliament-tooltip")
            .style("position", "fixed")
            .style("left", `${event.clientX + 10}px`)
            .style("top", `${event.clientY + 10}px`)
            .style("background", "#1f1f23")
            .style("color", "white")
            .style("padding", "8px 12px")
            .style("border-radius", "6px")
            .style("font-size", "14px")
            .style("box-shadow", "0 4px 6px rgba(0,0,0,0.3)")
            .style("pointer-events", "none")
            .style("z-index", "1000")
            .html(
              `<div style="font-weight: 600">${party.party}</div><div style="font-size: 12px; color: #d1d5db; margin-top: 2px">${party.seats} ${party.seats === 1 ? "seat" : "seats"}</div>`,
            );
        }
      })
      .on("mousemove", function (event) {
        d3.select(".parliament-tooltip")
          .style("left", `${event.clientX + 10}px`)
          .style("top", `${event.clientY + 10}px`);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("opacity", 1);
        d3.selectAll(".parliament-tooltip").remove();
      });

    // Add center text (majority line and leading party)
    const centerX = chartWidth / 2;
    const centerY = chartWidth / 2 - (isMobile ? 15 : 30);

    const textGroup = g.append("g").attr("class", "center-text");

    // Responsive font sizes
    const fontSize = {
      small: isMobile ? "9px" : "12px",
      medium: isMobile ? "11px" : "15px",
      tiny: isMobile ? "8px" : "11px",
    };

    textGroup
      .append("text")
      .attr("x", centerX)
      .attr("y", centerY - (isMobile ? 8 : 15))
      .attr("text-anchor", "middle")
      .attr("fill", "#9ca3af")
      .attr("font-size", fontSize.small)
      .text(`Majority: ${MAJORITY_THRESHOLD}`);

    const leadingParty = parties[0];
    if (leadingParty) {
      const hasMajority = leadingParty.seats >= MAJORITY_THRESHOLD;

      // Truncate party name on mobile
      const displayName =
        isMobile && leadingParty.party_name.length > 15
          ? leadingParty.party_name.substring(0, 15) + "..."
          : leadingParty.party_name;

      textGroup
        .append("text")
        .attr("x", centerX)
        .attr("y", centerY + 5)
        .attr("text-anchor", "middle")
        .attr("fill", "#e5e7eb")
        .attr("font-size", fontSize.medium)
        .attr("font-weight", "600")
        .text(displayName);

      textGroup
        .append("text")
        .attr("x", centerX)
        .attr("y", centerY + (isMobile ? 16 : 22))
        .attr("text-anchor", "middle")
        .attr("fill", "#d1d5db")
        .attr("font-size", fontSize.small)
        .text(`${leadingParty.seats} seats${hasMajority ? " ✓" : ""}`);
    }

    // Add total count at bottom
    const totalSeats = parties.reduce((sum, p) => sum + p.seats, 0);
    textGroup
      .append("text")
      .attr("x", centerX)
      .attr("y", chartWidth / 2 + (isMobile ? 25 : 40))
      .attr("text-anchor", "middle")
      .attr("fill", "#6b7280")
      .attr("font-size", fontSize.tiny)
      .text(`Total: ${totalSeats} / 650`);

    return () => {
      d3.selectAll(".parliament-tooltip").remove();
    };
  }, [parties, containerWidth]);

  // Generate accessible description
  const description = parties
    .map((p) => `${p.party_name}: ${p.seats} seats`)
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Parliamentary Seats</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="flex flex-col items-center">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${containerWidth} ${containerWidth / 2 + 60}`}
            aria-label={`Hemicycle diagram showing seat distribution: ${description}`}
            role="img"
            className="w-full h-auto"
            style={{ maxHeight: "400px" }}
          />

          {/* Legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:gap-3 max-w-full px-2">
            {parties.map((party) => (
              <div
                key={party.party_code}
                className="flex items-center gap-1.5 min-w-0"
              >
                <div
                  className="h-3 w-3 rounded-full border border-gray-700 flex-shrink-0"
                  style={{
                    backgroundColor:
                      PARTY_COLORS[party.party_code] ?? "#2a2a2e",
                  }}
                />
                <span className="text-xs text-gray-300 truncate">
                  {party.party_name} ({party.seats})
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
