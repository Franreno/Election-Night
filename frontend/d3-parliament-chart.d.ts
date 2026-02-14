declare module "d3-parliament-chart" {
  import { Selection } from "d3";

  export interface ParliamentChartData {
    seats?: number;
    color?: string;
    x?: number;
    y?: number;
    [key: string]: any;
  }

  export interface ParliamentChart {
    (selection: Selection<any, any, any, any>): void;
    (data: ParliamentChartData[], width: number): ParliamentChart;
    data(): ParliamentChartData[];
    data(data: ParliamentChartData[]): ParliamentChart;
    aggregatedData(data: ParliamentChartData[]): ParliamentChart;
    width(width: number): ParliamentChart;
    sections(sections: number): ParliamentChart;
    sectionGap(gap: number): ParliamentChart;
    seatRadius(radius: number): ParliamentChart;
    rowHeight(height: number): ParliamentChart;
    debug(debug: boolean): ParliamentChart;
  }

  export function parliamentChart(
    data: ParliamentChartData[],
    width: number
  ): ParliamentChart;

  export function getParliamentPoints(
    totalPoints: number,
    options: {
      sections?: number;
      sectionGap?: number;
      seatRadius?: number;
      rowHeight?: number;
    },
    graphicWidth: number
  ): Array<{ x: number; y: number }>;
}
