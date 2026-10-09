"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type UsageChartProps = {
  /** One bar an hour or a day, oldest first, each with the label under it. */
  data: { label: string; succeeded: number; failed: number }[];
  labels: { succeeded: string; failed: string };
};

/**
 * The calls of a period over time: one bar an hour or a day, the failed calls stacked on those
 * that succeeded. The figures are in the totals and the table beside it as text; the caller
 * describes the chart for a screen reader.
 */
function UsageChart({ data, labels }: UsageChartProps) {
  const config = {
    succeeded: { label: labels.succeeded, color: "var(--primary)" },
    failed: { label: labels.failed, color: "var(--destructive)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="succeeded"
          stackId="calls"
          fill="var(--color-succeeded)"
          radius={[0, 0, 4, 4]}
        />
        <Bar dataKey="failed" stackId="calls" fill="var(--color-failed)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export { UsageChart };
