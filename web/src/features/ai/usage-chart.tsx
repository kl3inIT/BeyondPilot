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
import { chartDrawMs } from "@/lib/motion";

type UsageChartProps = {
  /** One bar an hour or a day, oldest first, each with the label under it. */
  data: { label: string; succeeded: number; failed: number }[];
  /** What the chart shows and the period it covers, for a screen reader. */
  name: string;
  /** The two series, and `calls`, what the y axis counts. */
  labels: { succeeded: string; failed: string; calls: string };
  /** `compact` is the chart beside other figures: lower, without the value axis and the legend. */
  size?: "full" | "compact";
};

/**
 * The calls of a period over time: one bar an hour or a day, the failed calls stacked on those
 * that succeeded. The figures are in the totals and the table beside it as text; the caller
 * names the chart for a screen reader. The two series differ by colour and by their place in the
 * stack, and are named in the legend and the tooltip. It draws once, in `chartDrawMs`.
 */
function UsageChart({ data, name, labels, size = "full" }: UsageChartProps) {
  const config = {
    succeeded: { label: labels.succeeded, color: "var(--primary)" },
    failed: { label: labels.failed, color: "var(--destructive)" },
  } satisfies ChartConfig;
  const compact = size === "compact";

  return (
    <ChartContainer
      config={config}
      className={compact ? "aspect-auto h-32 w-full" : "aspect-auto h-64 w-full"}
    >
      <BarChart accessibilityLayer aria-label={name} data={data} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        {!compact && (
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={56}
            label={{
              value: labels.calls,
              angle: -90,
              position: "insideLeft",
              textAnchor: "middle",
              fill: "var(--muted-foreground)",
            }}
          />
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        {!compact && <ChartLegend content={<ChartLegendContent />} />}
        <Bar
          dataKey="succeeded"
          stackId="calls"
          fill="var(--color-succeeded)"
          radius={[0, 0, 4, 4]}
          animationDuration={chartDrawMs}
        />
        <Bar
          dataKey="failed"
          stackId="calls"
          fill="var(--color-failed)"
          radius={[4, 4, 0, 0]}
          animationDuration={chartDrawMs}
        />
      </BarChart>
    </ChartContainer>
  );
}

export { UsageChart };
